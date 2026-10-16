// Initialize a NEW Aiven database once. Never drops or overwrites existing data.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
async function main() {
  if (process.env.DB_INIT_ON_START !== 'true') return;
  if (!process.env.DB_PASSWORD || !process.env.DB_HOST) throw new Error('Database credentials missing');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, ssl: { ca: (process.env.DB_CA_CERT || '').replace(/\\n/g, '\n'), rejectUnauthorized: true },
    multipleStatements: true, connectTimeout: 15000
  });
  try {
    const [tables] = await conn.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'roles'");
    if (tables[0].n) { console.log('FreightSync schema already present; skipping initialization'); return; }
    let sql = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
    sql = sql.replace(/CREATE DATABASE IF NOT EXISTS freightsync[\s\S]*?;/i, '').replace(/\bUSE freightsync\s*;/gi, '');
    // MySQL does not support ADD COLUMN IF NOT EXISTS.
    sql = sql.replace(/ADD COLUMN IF NOT EXISTS/g, 'ADD COLUMN');
    await conn.query(sql);
    console.log('FreightSync production schema initialized successfully');
  } finally { await conn.end(); }
}
main().catch(err => { console.error('Database initialization failed:', err.code || 'UNKNOWN', String(err.message || '').slice(0, 350)); process.exit(1); });
