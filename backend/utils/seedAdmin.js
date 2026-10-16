/**
 * Run with: npm run seed
 * Creates/updates the demo accounts from database/seed.sql with a real bcrypt
 * hash for the password "Password123!" (change after first login in production).
 */
const bcrypt = require('bcrypt');
const pool = require('../config/db');

const DEMO_USERS = [
  { username: 'admin', role_id: 1 },
  { username: 'lmanager', role_id: 2 },
  { username: 'rplanner', role_id: 3 },
  { username: 'opscoord', role_id: 4 },
  { username: 'spadmin1', role_id: 5 }
];

async function run() {
  const hash = await bcrypt.hash('Password123!', 10);
  for (const u of DEMO_USERS) {
    await pool.query('UPDATE users SET password_hash = ? WHERE username = ?', [hash, u.username]);
  }
  console.log('Demo user passwords set to "Password123!" for:', DEMO_USERS.map(u => u.username).join(', '));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
