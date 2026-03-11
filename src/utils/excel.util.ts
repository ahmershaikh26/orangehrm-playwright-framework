import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export class ExcelUtil {
  /**
   * Read sheet and return array of row objects
   */
  static readSheet<T = any>(filePath: string, sheetName?: string): T[] {
    if (!fs.existsSync(filePath)) throw new Error(`Excel file not found: ${filePath}`);
    const workbook: XLSX.IWorkBook = XLSX.readFile(filePath);
    const sheet = sheetName || workbook.SheetNames[0];
    if (!sheet || !workbook.Sheets[sheet]) return [];
    const worksheet = workbook.Sheets[sheet];
    return XLSX.utils.sheet_to_json<T>(worksheet, { defval: null } as any);
  }

  /**
   * Write array of objects to sheet (overwrites existing file or creates new)
   */
  static writeSheet(filePath: string, data: any[], sheetName = 'Sheet1'): void {
    try {
      const workbook: XLSX.IWorkBook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data || []);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      XLSX.writeFile(workbook, filePath);
    } catch (err) {
      throw new Error(`Failed to write Excel file ${filePath}: ${(err as Error).message}`);
    }
  }

  /**
   * Append rows to existing sheet (creates file/sheet if missing)
   */
  static appendRows(filePath: string, rows: any[], sheetName = 'Sheet1'): void {
    try {
      let workbook: XLSX.IWorkBook;
      if (fs.existsSync(filePath)) {
        workbook = XLSX.readFile(filePath);
      } else {
        workbook = XLSX.utils.book_new();
      }

      const existingRows: any[] = workbook.Sheets[sheetName]
        ? XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null })
        : [];

      const merged = existingRows.concat(rows || []);
      const worksheet = XLSX.utils.json_to_sheet(merged);

      workbook.Sheets[sheetName] = worksheet;
      if (!workbook.SheetNames) workbook.SheetNames = [];
      if (!workbook.SheetNames.includes(sheetName)) workbook.SheetNames.push(sheetName);

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      XLSX.writeFile(workbook, filePath);
    } catch (err) {
      throw new Error(`Failed to append rows to Excel file ${filePath}: ${(err as Error).message}`);
    }
  }
}