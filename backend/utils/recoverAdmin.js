// Explicit, idempotent administrator password recovery for a deployment owner.
// Set ADMIN_RECOVERY_PASSWORD in private Render environment settings, deploy,
// then remove the variable immediately after the reset succeeds.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const crypto = require('crypto');
async function main() {
  const password = process.env.ADMIN_RECOVERY_PASSWORD;
  if (!password) return;
  if (password.length < 12 || password.length > 72 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('ADMIN_RECOVERY_PASSWORD must be 12-72 characters with uppercase, lowercase, number, and symbol');
  }
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) throw new Error('BOOTSTRAP_ADMIN_EMAIL is required for recovery');
  const [rows] = await pool.query("SELECT u.user_id,u.password_hash FROM users u JOIN roles r ON u.role_id=r.role_id WHERE u.username='admin' AND u.email=? AND r.role_name='ADMIN' LIMIT 1",[email]);
  if (rows.length !== 1) throw new Error('Matching administrator not found; no password changed');
  if (await bcrypt.compare(password,rows[0].password_hash)) {
    console.log('Administrator recovery password already applied');
    return;
  }
  const hash = await bcrypt.hash(password,12);
  await pool.query('UPDATE users SET password_hash=?, must_change_password=1 WHERE user_id=?',[hash,rows[0].user_id]);
  console.log('Administrator recovery password applied; remove ADMIN_RECOVERY_PASSWORD from Render now');
}
main().catch(e=>{console.error('Administrator recovery failed:',e.message);process.exitCode=1;}).finally(()=>pool.end());
