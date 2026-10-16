const pool = require('../config/db');
const { ok, created, fail, notFound } = require('../utils/response');
const { generateCode } = require('../utils/codeGenerator');
const { logAction } = require('../utils/audit');

async function findConflict(vehicle_code, departure_time, arrival_time, excludeId = null) {
  const params = [vehicle_code, arrival_time, departure_time];
  let sql = `SELECT schedule_id, schedule_code, departure_time, arrival_time FROM schedules
             WHERE vehicle_code = ? AND status IN ('Scheduled','In Transit','Delayed')
             AND departure_time < ? AND arrival_time > ?`;
  if (excludeId) { sql += ' AND schedule_id != ?'; params.push(excludeId); }
  const [rows] = await pool.query(sql, params);
  return rows.length ? rows[0] : null;
}

async function listSchedules(req, res, next) {
  try {
    const { route_id, status, date_from, date_to, provider_id, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];
    if (route_id) { where.push('s.route_id = ?'); params.push(route_id); }
    if (status) { where.push('s.status = ?'); params.push(status); }
    if (req.user.role === 'SERVICE_PROVIDER_ADMIN') {
      if (!req.user.provider_id) return fail(res, 'Your account is not assigned to a service provider', 403);
      where.push('s.provider_id = ?'); params.push(req.user.provider_id);
    } else if (provider_id) { where.push('s.provider_id = ?'); params.push(provider_id); }
    if (date_from) { where.push('s.departure_time >= ?'); params.push(date_from); }
    if (date_to) { where.push('s.arrival_time <= ?'); params.push(date_to); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(
      `SELECT s.*, r.route_name,
              (SELECT sd.delay_reason FROM schedule_delays sd WHERE sd.schedule_id = s.schedule_id ORDER BY sd.date_reported DESC LIMIT 1) AS latest_delay_reason,
              (SELECT sd.date_reported FROM schedule_delays sd WHERE sd.schedule_id = s.schedule_id ORDER BY sd.date_reported DESC LIMIT 1) AS latest_delay_reported
       FROM schedules s
       LEFT JOIN routes r ON s.route_id = r.route_id
       ${whereClause} ORDER BY s.departure_time ASC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM schedules s ${whereClause}`, params);

    return ok(res, rows, { page: Number(page), limit: Number(limit), total: countRows[0].total });
  } catch (err) { next(err); }
}

async function getSchedule(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, r.route_name FROM schedules s LEFT JOIN routes r ON s.route_id = r.route_id
       WHERE s.schedule_id = ?`, [req.params.id]
    );
    if (rows.length === 0) return notFound(res, 'Schedule');
    if (req.user.role === 'SERVICE_PROVIDER_ADMIN' && Number(rows[0].provider_id) !== Number(req.user.provider_id)) return fail(res, 'You may only view schedules assigned to your service provider', 403);
    const [delays] = await pool.query('SELECT * FROM schedule_delays WHERE schedule_id = ? ORDER BY date_reported DESC', [req.params.id]);
    return ok(res, { ...rows[0], delays });
  } catch (err) { next(err); }
}

async function createSchedule(req, res, next) {
  try {
    const {
      route_id, departure_location, arrival_location, departure_time,
      arrival_time, vehicle_code, provider_id
    } = req.body;

    if (!route_id || !departure_location || !arrival_location || !departure_time || !arrival_time || !vehicle_code) {
      return fail(res, 'route_id, departure_location, arrival_location, departure_time, arrival_time, and vehicle_code are required', 400);
    }
    if (new Date(arrival_time) <= new Date(departure_time)) {
      return fail(res, 'arrival_time must be after departure_time', 400);
    }

    const conflict = await findConflict(vehicle_code, departure_time, arrival_time);
    if (conflict) {
      return fail(res, `Vehicle ${vehicle_code} is already scheduled (${conflict.schedule_code}) during this window`, 409, [conflict]);
    }

    const schedule_code = await generateCode(pool, 'schedules', 'schedule_code', 'SC');
    const [result] = await pool.query(
      `INSERT INTO schedules (schedule_code, route_id, departure_location, arrival_location,
        departure_time, arrival_time, vehicle_code, provider_id, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?)`,
      [schedule_code, route_id, departure_location, arrival_location, departure_time,
       arrival_time, vehicle_code, provider_id || null, req.user.user_id]
    );

    await logAction({ userId: req.user.user_id, action: 'CREATE_SCHEDULE', entityType: 'SCHEDULE', entityId: result.insertId, afterState: req.body });
    return created(res, { schedule_id: result.insertId, schedule_code });
  } catch (err) { next(err); }
}

async function updateSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM schedules WHERE schedule_id = ?', [id]);
    if (rows.length === 0) return notFound(res, 'Schedule');
    const existing = rows[0];

    const departure_time = req.body.departure_time || existing.departure_time;
    const arrival_time = req.body.arrival_time || existing.arrival_time;
    const vehicle_code = req.body.vehicle_code || existing.vehicle_code;

    const conflict = await findConflict(vehicle_code, departure_time, arrival_time, id);
    if (conflict) {
      return fail(res, `Vehicle ${vehicle_code} is already scheduled (${conflict.schedule_code}) during this window`, 409, [conflict]);
    }

    const fields = ['route_id', 'departure_location', 'arrival_location', 'departure_time', 'arrival_time', 'vehicle_code', 'provider_id'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (updates.length) {
      params.push(id);
      await pool.query(`UPDATE schedules SET ${updates.join(', ')} WHERE schedule_id = ?`, params);
    }

    await logAction({ userId: req.user.user_id, action: 'UPDATE_SCHEDULE', entityType: 'SCHEDULE', entityId: id, beforeState: existing, afterState: req.body });
    return ok(res, { schedule_id: Number(id) });
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['Scheduled', 'In Transit', 'Delayed', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) return fail(res, `status must be one of: ${validStatuses.join(', ')}`, 400);

    const [rows] = await pool.query('SELECT status FROM schedules WHERE schedule_id = ?', [id]);
    if (rows.length === 0) return notFound(res, 'Schedule');

    await pool.query('UPDATE schedules SET status = ? WHERE schedule_id = ?', [status, id]);
    await logAction({
      userId: req.user.user_id, action: 'UPDATE_SCHEDULE_STATUS', entityType: 'SCHEDULE', entityId: id,
      beforeState: { status: rows[0].status }, afterState: { status }
    });
    return ok(res, { schedule_id: Number(id), status });
  } catch (err) { next(err); }
}

async function logDelay(req, res, next) {
  try {
    const { id } = req.params;
    const { delay_reason, revised_arrival_time } = req.body;
    if (!delay_reason || !revised_arrival_time) return fail(res, 'delay_reason and revised_arrival_time are required', 400);

    const [rows] = await pool.query('SELECT * FROM schedules WHERE schedule_id = ?', [id]);
    if (rows.length === 0) return notFound(res, 'Schedule');
    if (req.user.role === 'SERVICE_PROVIDER_ADMIN' && Number(rows[0].provider_id) !== Number(req.user.provider_id)) return fail(res, 'You may only report delays for your service provider', 403);

    await pool.query(
      `INSERT INTO schedule_delays (schedule_id, delay_reason, original_arrival_time, revised_arrival_time, reported_by)
       VALUES (?, ?, ?, ?, ?)`,
      [id, delay_reason, rows[0].arrival_time, revised_arrival_time, req.user.user_id]
    );
    await pool.query(`UPDATE schedules SET status = 'Delayed', arrival_time = ? WHERE schedule_id = ?`, [revised_arrival_time, id]);

    await logAction({ userId: req.user.user_id, action: 'LOG_DELAY', entityType: 'SCHEDULE', entityId: id, afterState: req.body });
    return created(res, { schedule_id: Number(id), status: 'Delayed', revised_arrival_time });
  } catch (err) { next(err); }
}

async function calendarView(req, res, next) {
  try {
    const { from, to } = req.query;
    if (!from || !to) return fail(res, 'from and to query params are required', 400);

    const providerFilter = req.user.role === 'SERVICE_PROVIDER_ADMIN' ? ' AND s.provider_id = ?' : '';
    if (req.user.role === 'SERVICE_PROVIDER_ADMIN' && !req.user.provider_id) return fail(res, 'Your account is not assigned to a service provider', 403);
    const params = req.user.role === 'SERVICE_PROVIDER_ADMIN' ? [from, to, req.user.provider_id] : [from, to];
    const [rows] = await pool.query(
      `SELECT s.*, r.route_name FROM schedules s LEFT JOIN routes r ON s.route_id = r.route_id
       WHERE s.departure_time >= ? AND s.departure_time <= ?${providerFilter} ORDER BY s.departure_time ASC`, params
    );

    const grouped = {};
    for (const row of rows) {
      const day = String(row.departure_time).slice(0, 10);
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(row);
    }
    return ok(res, grouped);
  } catch (err) { next(err); }
}

module.exports = {
  listSchedules, getSchedule, createSchedule, updateSchedule,
  updateStatus, logDelay, calendarView
};
