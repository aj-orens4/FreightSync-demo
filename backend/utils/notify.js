const pool = require('../config/db');
async function notifyUser(userId, title, message, type='INFO', linkUrl=null) {
  if (!userId) return;
  await pool.query('INSERT INTO notifications (user_id,title,message,type,link_url) VALUES (?,?,?,?,?)',[userId,title,message,type,linkUrl]);
}
async function notifyAdmins(title,message,type='INFO',linkUrl=null){
  const [rows]=await pool.query(`SELECT u.user_id FROM users u JOIN roles r ON r.role_id=u.role_id WHERE r.role_name='ADMIN' AND u.is_active=1`);
  await Promise.all(rows.map(r=>notifyUser(r.user_id,title,message,type,linkUrl)));
}
module.exports={notifyUser,notifyAdmins};
