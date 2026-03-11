import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
const resemble: any = require('resemblejs');

export class VisualUtil {
  static async saveBaseline(page: Page, baselineName: string) {
    const baselineDir = path.resolve('artifacts', 'visual', 'baseline');
    if (!fs.existsSync(baselineDir)) fs.mkdirSync(baselineDir, { recursive: true });
    const buffer = await page.screenshot({ fullPage: true });
    const filePath = path.join(baselineDir, `${baselineName}.png`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  static async compareWithBaseline(page: Page, baselineName: string, diffTolerancePercent = 0.1) {
    const baselineDir = path.resolve('artifacts', 'visual', 'baseline');
    const baselinePath = path.join(baselineDir, `${baselineName}.png`);
    if (!fs.existsSync(baselinePath)) throw new Error(`Baseline not found: ${baselinePath}`);

    const runDir = path.resolve('artifacts', 'visual', 'current');
    if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });
    const currentPath = path.join(runDir, `${baselineName}-current.png`);
    const diffPath = path.join(runDir, `${baselineName}-diff.png`);

    const buffer = await page.screenshot({ fullPage: true });
    fs.writeFileSync(currentPath, buffer);

    return new Promise<{ isWithinTolerance: boolean; diffPercent: number; diffPath: string }>((resolve, reject) => {
      resemble(baselinePath)
        .compareTo(currentPath)
        .ignoreColors() // optional, can be configured
        .onComplete((data: any) => {
          const diffPercent = parseFloat(data.misMatchPercentage);
          // cast to any and prefer getBuffer(); fallback to constructing Buffer from data URL if necessary
          let diffBuffer: Buffer;
          try {
            diffBuffer = (data as any).getBuffer ? (data as any).getBuffer() : Buffer.from((data.getImageDataUrl() || '').split(',')[1] || '', 'base64');
          } catch {
            diffBuffer = Buffer.from('');
          }
          fs.writeFileSync(diffPath, diffBuffer);
          resolve({
            isWithinTolerance: diffPercent <= diffTolerancePercent,
            diffPercent,
            diffPath,
          });
        });
    });
  }
}