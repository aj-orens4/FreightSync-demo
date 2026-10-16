const pool = require('../config/db');
const { ok, created, fail, notFound } = require('../utils/response');
const { validate } = require('../utils/validate');

/**
 * Personal reminders are private to each user (never shared across accounts —
 * every query here is scoped by `user_id = req.user.user_id`, enforced at the
 * SQL level, not just hidden in the UI). This is what powers the "pin a
 * reminder on a date" feature on the Calendar page, separate from the
 * freight schedules that come from /schedules.
 */

async function listReminders(req, res, next) {
  try {
    const { from, to } = req.query;
    const where = ['user_id = ?'];
    const params = [req.user.user_id];
    if (from) { where.push('remind_at >= ?'); params.push(from); }
    if (to) { where.push('remind_at <= ?'); params.push(to); }

    const [rows] = await pool.query(
      `SELECT * FROM personal_reminders WHERE ${where.join(' AND ')} ORDER BY remind_at ASC`,
      params
    );
    return ok(res, rows);
  } catch (err) { next(err); }
}

async function createReminder(req, res, next) {
  try {
    const errors = validate(req.body, {
      title: { required: true, type: 'string', min: 1, max: 150, label: 'Title' },
      remind_at: { required: true, type: 'string', label: 'Reminder date/time' }
    });
    if (errors.length) return fail(res, errors[0], 400, errors);

    const { title, note = '', remind_at } = req.body;
    const [result] = await pool.query(
      `INSERT INTO personal_reminders (user_id, title, note, remind_at) VALUES (?, ?, ?, ?)`,
      [req.user.user_id, title, note, remind_at]
    );
    return created(res, { reminder_id: result.insertId });
  } catch (err) { next(err); }
}

async function updateReminder(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM personal_reminders WHERE reminder_id = ? AND user_id = ?', [id, req.user.user_id]);
    if (rows.length === 0) return notFound(res, 'Reminder');

    const { title, note, remind_at, is_completed, notified } = req.body;
    const fields = [];
    const params = [];
    if (title !== undefined) { fields.push('title = ?'); params.push(title); }
    if (note !== undefined) { fields.push('note = ?'); params.push(note); }
    if (remind_at !== undefined) { fields.push('remind_at = ?'); params.push(remind_at); }
    if (is_completed !== undefined) { fields.push('is_completed = ?'); params.push(is_completed ? 1 : 0); }
    if (notified !== undefined) { fields.push('notified = ?'); params.push(notified ? 1 : 0); }
    if (fields.length === 0) return fail(res, 'No fields to update', 400);

    params.push(id, req.user.user_id);
    await pool.query(`UPDATE personal_reminders SET ${fields.join(', ')} WHERE reminder_id = ? AND user_id = ?`, params);
    return ok(res, { reminder_id: Number(id) });
  } catch (err) { next(err); }
}

async function deleteReminder(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM personal_reminders WHERE reminder_id = ? AND user_id = ?', [id, req.user.user_id]);
    if (result.affectedRows === 0) return notFound(res, 'Reminder');
    return ok(res, { reminder_id: Number(id) });
  } catch (err) { next(err); }
}

module.exports = { listReminders, createReminder, updateReminder, deleteReminder };
