const pool = require('../config/db');
const { ok, fail } = require('../utils/response');

async function archiveColumnExists() {
  const [rows] = await pool.query("SHOW COLUMNS FROM audit_logs LIKE 'is_archived'");
  return rows.length > 0;
}

async function listLogs(req, res, next) {
  try {
    const { entity_type, user_id, date_from, date_to, archived = '0', page = 1, limit = 50 } = req.query;
    const supportsArchive = await archiveColumnExists();
    const where = [];
    const params = [];
    if (supportsArchive) { where.push('a.is_archived = ?'); params.push(archived === '1' ? 1 : 0); }
    else if (archived === '1') return ok(res, [], { page:Number(page), limit:Number(limit), total:0, archive_supported:false });
    if (entity_type) { where.push('a.entity_type = ?'); params.push(entity_type); }
    if (user_id) { where.push('a.user_id = ?'); params.push(user_id); }
    if (date_from) { where.push('a.date_created >= ?'); params.push(date_from); }
    if (date_to) { where.push('a.date_created <= ?'); params.push(date_to); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;
    const [rows] = await pool.query(
      `SELECT a.*, u.username, u.full_name FROM audit_logs a LEFT JOIN users u ON a.user_id = u.user_id ${whereClause} ORDER BY a.date_created DESC LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs a ${whereClause}`, params);
    return ok(res, rows, { page:safePage, limit:safeLimit, total:countRows[0].total, archive_supported:supportsArchive });
  } catch (err) { next(err); }
}

async function setArchived(req, res, next) {
  try {
    if (!(await archiveColumnExists())) return fail(res, 'Audit archiving is not installed. Run database/migration_audit_archive.sql once.', 409);
    const archived = req.body.archived === true || req.body.archived === 1;
    const [result] = await pool.query('UPDATE audit_logs SET is_archived = ? WHERE log_id = ?', [archived ? 1 : 0, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success:false, message:'Audit entry not found' });
    return ok(res, { log_id:Number(req.params.id), is_archived:archived });
  } catch (err) { next(err); }
}

module.exports = { listLogs, setArchived };
