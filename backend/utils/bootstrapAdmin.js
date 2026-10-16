// One-time first administrator provisioning; never changes existing accounts.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');
async function main() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  if (!email || !password) {
    console.log('Admin bootstrap pending: set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in Render.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid bootstrap admin email');
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) throw new Error('Bootstrap password must have 12+ characters, uppercase, lowercase, digit, and symbol');
  const [existing] = await pool.query('SELECT user_id FROM users LIMIT 1');
  if (existing.length) { console.log('Existing users detected; admin bootstrap skipped.'); return; }
  const [roles] = await pool.query("SELECT role_id FROM roles WHERE role_name='ADMIN' LIMIT 1");
  if (!roles.length) throw new Error('ADMIN role not initialized');
  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.query("INSERT INTO users (username,email,password_hash,full_name,role_id,is_active,must_change_password) VALUES (?,?,?,?,?,1,1)",['admin',email,hash,'FreightSync Administrator',roles[0].role_id]);
  console.log('First administrator account provisioned, user ID:', result.insertId);
}
main().catch(e=>{console.error('Admin bootstrap error:',e.code||e.message);process.exitCode=1}).finally(()=>pool.end());
