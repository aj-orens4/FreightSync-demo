const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { ok, created, fail, notFound } = require('../utils/response');
const { logAction } = require('../utils/audit');

async function listUsers(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.full_name, u.is_active, u.must_change_password, u.provider_id,
              r.role_name, u.date_created
       FROM users u JOIN roles r ON u.role_id = r.role_id ORDER BY u.date_created DESC`
    );
    return ok(res, rows);
  } catch (err) { next(err); }
}

async function createUser(req, res, next) {
  try {
    const { username, email, password, full_name, role, provider_id = null } = req.body;
    if (!username || !email || !password || !full_name || !role) {
      return fail(res, 'username, email, password, full_name, and role are required', 400);
    }
    if (password.length < 8 || password.length > 72 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return fail(res, 'Password must be 8-72 characters and include uppercase, lowercase, number, and symbol', 400);
    }
    if (role === 'SERVICE_PROVIDER_ADMIN' && !provider_id) return fail(res, 'Service Provider Admin requires a provider assignment', 400);
    if (provider_id) { const [providers]=await pool.query('SELECT provider_id FROM service_providers WHERE provider_id = ?', [provider_id]); if(!providers.length) return fail(res, 'Select a valid service provider', 400); }
    const [existing] = await pool.query('SELECT user_id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length) return fail(res, 'Username or email is already in use', 409);
    const [roleRows] = await pool.query('SELECT role_id FROM roles WHERE role_name = ?', [role]);
    if (!roleRows.length) return fail(res, 'Invalid role', 400);
    const role_id = roleRows[0].role_id;
    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id, provider_id, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [username, email, password_hash, full_name, role_id, provider_id]
    );

    await logAction({ userId: req.user.user_id, action: 'CREATE_USER', entityType: 'USER', entityId: result.insertId, afterState: { username, email, role_id } });
    return created(res, { user_id: result.insertId, must_change_password: true });
  } catch (err) { next(err); }
}

async function listProviders(req,res,next) {
  try { const [rows]=await pool.query('SELECT provider_id, provider_code, provider_name, status FROM service_providers ORDER BY provider_name'); return ok(res,rows); } catch(err){ next(err); }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [id]);
    if (rows.length === 0) return notFound(res, 'User');

    const { full_name, email, role, provider_id, is_active } = req.body;
    let role_id = null;
    if (role) { const [roleRows] = await pool.query('SELECT role_id FROM roles WHERE role_name = ?', [role]); if (!roleRows.length) return fail(res, 'Invalid role', 400); role_id = roleRows[0].role_id; }
    const normalizedProvider = provider_id === '' || provider_id === undefined ? rows[0].provider_id : (provider_id === null ? null : Number(provider_id));
    if (normalizedProvider !== null) {
      const [providers] = await pool.query('SELECT provider_id FROM service_providers WHERE provider_id = ?', [normalizedProvider]);
      if (!providers.length) return fail(res, 'Select a valid service provider. The previous Provider ID did not exist.', 400);
    }
    if (role === 'SERVICE_PROVIDER_ADMIN' && normalizedProvider === null) return fail(res, 'Service Provider Admin requires a provider assignment', 400);
    await pool.query(
      `UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email),
        role_id = COALESCE(?, role_id), provider_id = ?,
        is_active = COALESCE(?, is_active) WHERE user_id = ?`,
      [full_name, email, role_id, normalizedProvider, is_active, id]
    );

    await logAction({ userId: req.user.user_id, action: 'UPDATE_USER', entityType: 'USER', entityId: id, beforeState: rows[0], afterState: req.body });
    return ok(res, { user_id: Number(id) });
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { temporary_password } = req.body;
    if (!temporary_password || temporary_password.length < 8 || temporary_password.length > 72 || !/[A-Z]/.test(temporary_password) || !/[a-z]/.test(temporary_password) || !/\d/.test(temporary_password) || !/[^A-Za-z0-9]/.test(temporary_password)) {
      return fail(res, 'Temporary password must be 8-72 characters and include uppercase, lowercase, number, and symbol', 400);
    }
    const [rows] = await pool.query('SELECT user_id, username FROM users WHERE user_id = ?', [id]);
    if (!rows.length) return notFound(res, 'User');
    const password_hash = await bcrypt.hash(temporary_password, 10);
    await pool.query('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE user_id = ?', [password_hash, id]);
    await logAction({ userId: req.user.user_id, action: 'ADMIN_RESET_PASSWORD', entityType: 'USER', entityId: id, afterState: { must_change_password: true } });
    return ok(res, { user_id: Number(id), must_change_password: true });
  } catch (err) { next(err); }
}

module.exports = { listUsers, listProviders, createUser, updateUser, resetPassword };
