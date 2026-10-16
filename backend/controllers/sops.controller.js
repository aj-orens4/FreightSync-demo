const pool = require('../config/db');
const { ok, created, fail, notFound } = require('../utils/response');
const { generateCode } = require('../utils/codeGenerator');
const { logAction } = require('../utils/audit');

async function listSops(req, res, next) {
  try {
    const { category, status, q, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];
    if (category) { where.push('category = ?'); params.push(category); }
    if (status) { where.push('approval_status = ?'); params.push(status); }
    if (q) { where.push('MATCH(sop_title, description) AGAINST (? IN NATURAL LANGUAGE MODE)'); params.push(q); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(
      `SELECT * FROM sops ${whereClause} ORDER BY date_updated DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM sops ${whereClause}`, params);

    return ok(res, rows, { page: Number(page), limit: Number(limit), total: countRows[0].total });
  } catch (err) { next(err); }
}

async function getSop(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM sops WHERE sop_id = ?', [req.params.id]);
    if (rows.length === 0) return notFound(res, 'SOP');
    const [docs] = await pool.query('SELECT * FROM sop_documents WHERE sop_id = ?', [req.params.id]);
    return ok(res, { ...rows[0], documents: docs });
  } catch (err) { next(err); }
}

async function createSop(req, res, next) {
  try {
    const { sop_title, category, description = '' } = req.body;
    if (!sop_title || !category) return fail(res, 'sop_title and category are required', 400);

    const sop_code = await generateCode(pool, 'sops', 'sop_code', 'SOP');
    const [result] = await pool.query(
      `INSERT INTO sops (sop_code, sop_title, category, description, author_id, approval_status)
       VALUES (?, ?, ?, ?, ?, 'Draft')`,
      [sop_code, sop_title, category, description, req.user.user_id]
    );

    await logAction({ userId: req.user.user_id, action: 'CREATE_SOP', entityType: 'SOP', entityId: result.insertId, afterState: req.body });
    return created(res, { sop_id: result.insertId, sop_code });
  } catch (err) { next(err); }
}

async function updateSop(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM sops WHERE sop_id = ?', [id]);
    if (rows.length === 0) return notFound(res, 'SOP');
    const existing = rows[0];

    await conn.beginTransaction();

    if (existing.approval_status === 'Published') {
      await conn.query(
        `INSERT INTO sop_versions (sop_id, version_number, snapshot_json, changed_by) VALUES (?, ?, ?, ?)`,
        [id, existing.version_number, JSON.stringify(existing), req.user.user_id]
      );
      await conn.query('UPDATE sops SET version_number = version_number + 1 WHERE sop_id = ?', [id]);
    }

    const { sop_title, category, description } = req.body;
    await conn.query(
      `UPDATE sops SET sop_title = COALESCE(?, sop_title), category = COALESCE(?, category),
        description = COALESCE(?, description) WHERE sop_id = ?`,
      [sop_title, category, description, id]
    );

    await conn.commit();
    await logAction({ userId: req.user.user_id, action: 'UPDATE_SOP', entityType: 'SOP', entityId: id, beforeState: existing, afterState: req.body });

    return ok(res, { sop_id: Number(id) });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

function changeStatus(newStatus, allowedFrom) {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const [rows] = await pool.query('SELECT approval_status FROM sops WHERE sop_id = ?', [id]);
      if (rows.length === 0) return notFound(res, 'SOP');
      if (allowedFrom && !allowedFrom.includes(rows[0].approval_status)) {
        return fail(res, `Cannot move SOP from '${rows[0].approval_status}' to '${newStatus}'`, 409);
      }
      await pool.query('UPDATE sops SET approval_status = ? WHERE sop_id = ?', [newStatus, id]);
      await logAction({
        userId: req.user.user_id, action: `SOP_${newStatus.toUpperCase()}`, entityType: 'SOP', entityId: id,
        beforeState: { approval_status: rows[0].approval_status }, afterState: { approval_status: newStatus }
      });
      return ok(res, { sop_id: Number(id), approval_status: newStatus });
    } catch (err) { next(err); }
  };
}

async function getVersions(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM sop_versions WHERE sop_id = ? ORDER BY version_number DESC`, [req.params.id]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
}

async function attachDocument(req, res, next) {
  try {
    const { id } = req.params;
    const { file_name, file_path } = req.body;
    if (!file_name || !file_path) return fail(res, 'file_name and file_path are required', 400);

    const [result] = await pool.query(
      `INSERT INTO sop_documents (sop_id, file_name, file_path, uploaded_by) VALUES (?, ?, ?, ?)`,
      [id, file_name, file_path, req.user.user_id]
    );
    await logAction({ userId: req.user.user_id, action: 'ATTACH_SOP_DOCUMENT', entityType: 'SOP', entityId: id, afterState: req.body });
    return created(res, { document_id: result.insertId });
  } catch (err) { next(err); }
}

module.exports = {
  listSops, getSop, createSop, updateSop, getVersions, attachDocument,
  submit: changeStatus('Submitted', ['Draft', 'Rejected']),
  approve: changeStatus('Approved', ['Submitted']),
  reject: changeStatus('Rejected', ['Submitted']),
  publish: changeStatus('Published', ['Approved']),
  archive: changeStatus('Archived', ['Published', 'Approved', 'Rejected'])
};
