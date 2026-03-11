import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
const resemble: any = require('resemblejs');
import dotenv from 'dotenv';
dotenv.config();

type FigmaComponent = {
  id: string;
  name: string;
  type: string;
  imagePath?: string;
  nodeId?: string;
};

type FigmaDesignResult = {
  fileId: string;
  fetchedAt: string;
  components: FigmaComponent[];
  raw?: any;
};

const FIGMA_API_BASE = 'https://api.figma.com/v1';
const CACHE_DIR = path.resolve('artifacts', 'figma-cache');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function downloadUrlToFile(url: string, dest: string, timeout = 20000) {
  const writer = fs.createWriteStream(dest);
  const resp = await axios.get(url, { responseType: 'stream', timeout });
  return new Promise<void>((resolve, reject) => {
    resp.data.pipe(writer);
    let error: Error | null = null;
    writer.on('error', (err) => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on('close', () => {
      if (!error) resolve();
    });
  });
}

/**
 * Traverse Figma document tree and collect FRAME/COMPONENT nodes
 */
function collectNodes(node: any, out: any[] = []) {
  if (!node) return out;
  const type = node.type;
  if (type === 'FRAME' || type === 'COMPONENT' || type === 'INSTANCE' || type === 'GROUP' || type === 'COMPONENT_SET') {
    out.push(node);
  }
  if (node.children && Array.isArray(node.children)) {
    for (const c of node.children) collectNodes(c, out);
  }
  return out;
}

export class FigmaUtil {
  /**
   * Compare two images (local path or remote URL for expected).
   * Writes a diff image next to actual image with suffix `-figma-diff.png`.
   * Returns true when diff percent <= tolerance (env VISUAL_TOLERANCE or default 0.1).
   */
  static async compareDesigns(actualImagePath: string, expectedImagePath: string): Promise<boolean> {
    ensureDir(CACHE_DIR);

    // Resolve expected: if URL, download to cache
    let expectedLocal = expectedImagePath;
    if (/^https?:\/\//i.test(expectedImagePath)) {
      const fileName = `${Date.now()}-${path.basename(expectedImagePath).split('?')[0]}`;
      expectedLocal = path.join(CACHE_DIR, fileName);
      if (!fs.existsSync(expectedLocal)) {
        await downloadUrlToFile(expectedImagePath, expectedLocal);
      }
    } else if (!fs.existsSync(expectedLocal)) {
      throw new Error(`Expected design image not found: ${expectedImagePath}`);
    }

    if (!fs.existsSync(actualImagePath)) {
      throw new Error(`Actual screenshot not found: ${actualImagePath}`);
    }

    const diffTolerance = Number(process.env.VISUAL_TOLERANCE ?? '0.1');

    return await new Promise<boolean>((resolve, reject) => {
      try {
        resemble(actualImagePath)
          .compareTo(expectedLocal)
          .ignoreAntialiasing() // make comparison more robust to font rendering
          .onComplete((data: any) => {
            const misMatch = parseFloat(data.misMatchPercentage || '0');
            // prefer getBuffer if available, else parse data URL
            let diffBuffer: Buffer;
            try {
              diffBuffer = (data as any).getBuffer ? (data as any).getBuffer() : Buffer.from((data.getImageDataUrl() || '').split(',')[1] || '', 'base64');
            } catch {
              diffBuffer = Buffer.from('');
            }

            const diffPath = path.join(path.dirname(actualImagePath), `${path.basename(actualImagePath, path.extname(actualImagePath))}-figma-diff.png`);
            try {
              fs.writeFileSync(diffPath, diffBuffer);
            } catch {
              // ignore write errors but continue
            }

            const within = misMatch <= diffTolerance;
            resolve(within);
          });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Fetch Figma file and rendered images for FRAME/COMPONENT nodes.
   * Caches downloaded images to artifacts/figma-cache/<fileId>/
   * Returns a FigmaDesignResult describing components and local image paths.
   */
  static async fetchFigmaDesign(figmaFileId: string, accessToken?: string): Promise<FigmaDesignResult> {
    ensureDir(CACHE_DIR);
    const token = accessToken || process.env.FIGMA_TOKEN;
    if (!token) throw new Error('Figma access token not provided. Set FIGMA_TOKEN in env or pass accessToken.');

    const headers = { Authorization: `Bearer ${token}` };
    // 1) fetch file JSON (metadata)
    const fileUrl = `${FIGMA_API_BASE}/files/${encodeURIComponent(figmaFileId)}`;
    const fileResp = await axios.get(fileUrl, { headers, timeout: 20000 }).catch((e) => {
      throw new Error(`Failed to fetch Figma file: ${(e as any).message || e}`);
    });

    const fileJson = fileResp.data;
    // collect candidate nodes
    const nodes = collectNodes(fileJson?.document || fileJson?.doc || fileJson);

    // dedupe and map node ids, limit to reasonable count to avoid huge requests
    const uniqueNodes = Array.from(new Map(nodes.map((n: any) => [n.id, n])).values()).slice(0, 60);
    const ids = uniqueNodes.map((n: any) => n.id);
    const outDir = path.join(CACHE_DIR, figmaFileId);
    ensureDir(outDir);

    // 2) request images for these node ids
    const CHUNK = 45; // figma images endpoint may have limits; chunk if needed
    const imagesMap: Record<string, string> = {};

    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const imagesUrl = `${FIGMA_API_BASE}/images/${encodeURIComponent(figmaFileId)}?ids=${encodeURIComponent(slice.join(','))}&format=png&scale=1`;
      let imgsResp;
      try {
        imgsResp = await axios.get(imagesUrl, { headers, timeout: 20000 });
      } catch (e) {
        // skip this chunk on error but continue with next
        continue;
      }
      const images = imgsResp?.data?.images || {};
      Object.assign(imagesMap, images);
    }

    const components: FigmaComponent[] = [];
    for (const node of uniqueNodes) {
      const id = node.id;
      const name = node.name || id;
      const type = node.type || node.nodeType || 'UNKNOWN';
      const imageUrl = imagesMap[id];
      let imagePath: string | undefined;
      if (imageUrl) {
        const safeName = `${name.replace(/[^\w.-]/g, '_')}-${id}.png`;
        imagePath = path.join(outDir, safeName);
        if (!fs.existsSync(imagePath)) {
          try {
            await downloadUrlToFile(imageUrl, imagePath);
          } catch {
            imagePath = undefined;
          }
        }
      }
      components.push({ id, name, type, imagePath, nodeId: id });
    }

    return {
      fileId: figmaFileId,
      fetchedAt: new Date().toISOString(),
      components,
      raw: fileJson,
    };
  }

  /**
   * Given a raw figma design object (as returned by fetchFigmaDesign or Figma API),
   * extract a simplified array of components with ids, names and image paths/urls.
   */
  static async extractComponentsFromDesign(figmaDesign: any): Promise<FigmaComponent[]> {
    if (!figmaDesign) return [];
    // If it's our FigmaDesignResult
    if (Array.isArray(figmaDesign.components)) {
      return figmaDesign.components.map((c: any) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        imagePath: c.imagePath,
        nodeId: c.nodeId,
      }));
    }

    // If it's raw Figma file JSON, attempt to collect nodes and return with image URLs if any
    const document = figmaDesign.document || figmaDesign;
    const nodes = collectNodes(document);
    const comps = (nodes || []).map((n: any) => ({
      id: n.id,
      name: n.name,
      type: n.type || 'UNKNOWN',
    }));
    // if images map present (from images endpoint), merge URLs
    if (figmaDesign.images && typeof figmaDesign.images === 'object') {
      return comps.map((c: any) => ({
        ...c,
        imagePath: figmaDesign.images[c.id] || undefined,
      }));
    }

    return comps;
  }
}