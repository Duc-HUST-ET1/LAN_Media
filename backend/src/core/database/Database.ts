import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { databaseConfig } from '../config/DatabaseConfig.js';

export type SqlValue = string | number | Date | Buffer | null;

export class Database {
  private readonly pool: Pool;

  constructor() {
    this.pool = mysql.createPool({
      ...databaseConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: 'Z',
      enableKeepAlive: true,
      connectTimeout: 5000,
    });
  }

  async query<T extends RowDataPacket>(sql: string, values: SqlValue[] = []): Promise<T[]> {
    const [rows] = await this.pool.execute<(T & RowDataPacket)[]>(sql, values);
    return rows;
  }

  async execute(sql: string, values: SqlValue[] = []): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute<ResultSetHeader>(sql, values);
    return result;
  }

  async ping(): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.ping();
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const database = new Database();
