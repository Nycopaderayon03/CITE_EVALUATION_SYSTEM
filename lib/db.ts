import mysql from 'mysql2/promise';

// Prevent connection leaks during Next.js hot reloads in development.
// Without this, every HMR cycle creates a new pool while the old one's
// connections stay open, eventually exhausting MySQL's max_connections.
const globalForDb = globalThis as unknown as { __dbPool?: mysql.Pool };

const pool = globalForDb.__dbPool ?? mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD as string,
  database: process.env.DB_NAME || 'cite_es',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__dbPool = pool;
}

export async function query(sql: string, values?: any[]) {
  try {
    const connection = await pool.getConnection();
    try {
      const [results] = values
        ? await connection.execute(sql, values)
        : await connection.execute(sql);
      return results;
    } finally {
      connection.release();
    }
  } catch (error) {
    // If the database is unavailable, fall back to empty results.
    // This allows the app to run without a database while still rendering.
    console.warn('DB query failed, returning empty result:', error);
    return [];
  }
}

export async function queryOne(sql: string, values?: any[]) {
  try {
    const results = await query(sql, values);
    return Array.isArray(results) && results.length > 0 ? results[0] : null;
  } catch (error) {
    console.warn('DB queryOne failed, returning null:', error);
    return null;
  }
}

export default pool;
