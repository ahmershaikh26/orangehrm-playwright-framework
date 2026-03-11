import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

const DB_TYPE = process.env.DB_TYPE || 'mysql';

export class DBUtil {
  private pool: mysql.Pool | null = null;

  constructor() {
    if (DB_TYPE !== 'mysql') {
      throw new Error('DBUtil currently supports mysql via mysql2. Set DB_TYPE=mysql in .env');
    }
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '',
      connectionLimit: 5,
    });
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.pool) throw new Error('DB pool not initialized');
    const [rows] = await this.pool.query(sql, params);
    return rows as T[];
  }

  async close() {
    await this.pool?.end();
  }
}