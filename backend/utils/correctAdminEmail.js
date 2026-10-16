// One-time correction of the first administrator's verification email.
// Runs only when ADMIN_EMAIL_CORRECTION is explicitly configured.
require('dotenv').config();
const pool = require('../config/db');
async function main() {
  const target=(process.env.ADMIN_EMAIL_CORRECTION||'').trim().toLowerCase();
  if (!target) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) throw new Error('Invalid admin correction email');
  const original=(process.env.BOOTSTRAP_ADMIN_EMAIL||'').trim().toLowerCase();
  if (!original) throw new Error('Missing original administrator email');
  const [users]=await pool.query("SELECT u.user_id,u.email FROM users u JOIN roles r ON u.role_id=r.role_id WHERE u.username='admin' AND r.role_name='ADMIN' LIMIT 1");
  if (users.length!==1) throw new Error('Administrator not found');
  if (users[0].email.toLowerCase()===target) {console.log('Administrator email correction already applied');return;}
  if (users[0].email.toLowerCase()!==original) throw new Error('Administrator email has changed; refusing to overwrite');
  const [existing]=await pool.query('SELECT user_id FROM users WHERE email=? AND user_id<>? LIMIT 1',[target,users[0].user_id]);
  if(existing.length) throw new Error('Target email is already in use');
  await pool.query('UPDATE users SET email=? WHERE user_id=?',[target,users[0].user_id]);
  console.log('Administrator verification email correction applied');
}
main().catch(e=>{console.error('Administrator email correction failed:',e.message);process.exitCode=1;}).finally(()=>pool.end());
