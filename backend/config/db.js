const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'freightsync',
  // Aiven managed MySQL requires TLS. Do not disable certificate verification.
  ssl: process.env.DB_SSL === 'true' ? { ca: (process.env.DB_CA_CERT || '').replace(/\\n/g, '\n'), rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

module.exports = pool;
