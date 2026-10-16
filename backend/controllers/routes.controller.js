const pool = require('../config/db');
const { ok, created, fail, notFound } = require('../utils/response');
const { generateCode } = require('../utils/codeGenerator');
const { logAction } = require('../utils/audit');

const OPTIMIZATION_DETOUR_THRESHOLD = 1.3; // flag if a stop's cumulative distance implies >30% detour vs direct segment share

async function listRoutes(req, res, next) {
  try {
    const { status, origin, destination, provider_id, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];

    if (status) { where.push('r.route_status = ?'); params.push(status); }
    if (origin) { where.push('r.origin LIKE ?'); params.push(`%${origin}%`); }
    if (destination) { where.push('r.destination LIKE ?'); params.push(`%${destination}%`); }
    if (provider_id) { where.push('r.provider_id = ?'); params.push(provider_id); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(
      `SELECT r.*, sp.provider_name FROM routes r
       LEFT JOIN service_providers sp ON r.provider_id = sp.provider_id
       ${whereClause} ORDER BY r.date_created DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM routes r ${whereClause}`, params);

    return ok(res, rows, { page: Number(page), limit: Number(limit), total: countRows[0].total });
  } catch (err) { next(err); }
}

async function getRoute(req, res, next) {
  try {
    const [routeRows] = await pool.query(
      `SELECT r.*, sp.provider_name FROM routes r
       LEFT JOIN service_providers sp ON r.provider_id = sp.provider_id
       WHERE r.route_id = ?`, [req.params.id]
    );
    if (routeRows.length === 0) return notFound(res, 'Route');

    const [stops] = await pool.query(
      `SELECT * FROM route_stops WHERE route_id = ? ORDER BY sequence_no ASC`, [req.params.id]
    );
    return ok(res, { ...routeRows[0], stops });
  } catch (err) { next(err); }
}

async function createRoute(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { route_name, origin, destination, stops = [], provider_id, estimated_travel_min = 0 } = req.body;
    if (!route_name || !origin || !destination) {
      return fail(res, 'route_name, origin, and destination are required', 400);
    }

    const totalDistance = stops.length
      ? Math.max(...stops.map(s => Number(s.distance_from_origin_km) || 0))
      : 0;

    const route_code = await generateCode(pool, 'routes', 'route_code', 'RT');

    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO routes (route_code, route_name, origin, destination, total_distance_km,
        estimated_travel_min, route_status, provider_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'Under Review', ?, ?)`,
      [route_code, route_name, origin, destination, totalDistance, estimated_travel_min, provider_id || null, req.user.user_id]
    );
    const routeId = result.insertId;

    for (const stop of stops) {
      await conn.query(
        `INSERT INTO route_stops (route_id, stop_name, sequence_no, distance_from_origin_km, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)`,
        [routeId, stop.stop_name, stop.sequence_no, stop.distance_from_origin_km || 0, stop.latitude || null, stop.longitude || null]
      );
    }

    await conn.commit();
    await logAction({ userId: req.user.user_id, action: 'CREATE_ROUTE', entityType: 'ROUTE', entityId: routeId, afterState: req.body });

    return created(res, { route_id: routeId, route_code });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

async function updateRoute(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const [existingRows] = await pool.query('SELECT * FROM routes WHERE route_id = ?', [id]);
    if (existingRows.length === 0) return notFound(res, 'Route');

    const { route_name, origin, destination, stops, provider_id, estimated_travel_min } = req.body;

    await conn.beginTransaction();
    await conn.query(
      `UPDATE routes SET route_name = COALESCE(?, route_name), origin = COALESCE(?, origin),
        destination = COALESCE(?, destination), provider_id = COALESCE(?, provider_id),
        estimated_travel_min = COALESCE(?, estimated_travel_min) WHERE route_id = ?`,
      [route_name, origin, destination, provider_id, estimated_travel_min, id]
    );

    if (Array.isArray(stops)) {
      await conn.query('DELETE FROM route_stops WHERE route_id = ?', [id]);
      for (const stop of stops) {
        await conn.query(
          `INSERT INTO route_stops (route_id, stop_name, sequence_no, distance_from_origin_km, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, stop.stop_name, stop.sequence_no, stop.distance_from_origin_km || 0, stop.latitude || null, stop.longitude || null]
        );
      }
      const totalDistance = stops.length ? Math.max(...stops.map(s => Number(s.distance_from_origin_km) || 0)) : 0;
      await conn.query('UPDATE routes SET total_distance_km = ? WHERE route_id = ?', [totalDistance, id]);
    }

    await conn.commit();
    await logAction({ userId: req.user.user_id, action: 'UPDATE_ROUTE', entityType: 'ROUTE', entityId: id, beforeState: existingRows[0], afterState: req.body });

    return ok(res, { route_id: Number(id) });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

async function updateRouteStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['Active', 'Inactive', 'Under Review', 'Discontinued'];
    if (!validStatuses.includes(status)) return fail(res, `status must be one of: ${validStatuses.join(', ')}`, 400);

    const [existing] = await pool.query('SELECT route_status FROM routes WHERE route_id = ?', [id]);
    if (existing.length === 0) return notFound(res, 'Route');

    await pool.query('UPDATE routes SET route_status = ? WHERE route_id = ?', [status, id]);
    await logAction({
      userId: req.user.user_id, action: 'UPDATE_ROUTE_STATUS', entityType: 'ROUTE', entityId: id,
      beforeState: { status: existing[0].route_status }, afterState: { status }
    });

    return ok(res, { route_id: Number(id), status });
  } catch (err) { next(err); }
}

async function deleteRoute(req, res, next) {
  try {
    const { id } = req.params;
    const [activeSchedules] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM schedules WHERE route_id = ? AND status IN ('Scheduled','In Transit')`, [id]
    );
    if (activeSchedules[0].cnt > 0) {
      return fail(res, 'Cannot delete a route with active or in-transit schedules', 409);
    }
    const [result] = await pool.query('DELETE FROM routes WHERE route_id = ?', [id]);
    if (result.affectedRows === 0) return notFound(res, 'Route');

    await logAction({ userId: req.user.user_id, action: 'DELETE_ROUTE', entityType: 'ROUTE', entityId: id });
    return ok(res, { route_id: Number(id) });
  } catch (err) { next(err); }
}

async function routePerformance(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT status, COUNT(*) AS count FROM schedules WHERE route_id = ? GROUP BY status`, [id]
    );
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    const delayed = rows.find(r => r.status === 'Delayed')?.count || 0;
    const completed = rows.find(r => r.status === 'Completed')?.count || 0;

    return ok(res, {
      route_id: Number(id),
      total_schedules: total,
      completed,
      delayed,
      on_time_rate: total ? Number((((total - delayed) / total) * 100).toFixed(2)) : null,
      breakdown: rows
    });
  } catch (err) { next(err); }
}

async function routeOptimization(req, res, next) {
  try {
    const { id } = req.params;
    const [stops] = await pool.query(
      `SELECT * FROM route_stops WHERE route_id = ? ORDER BY sequence_no ASC`, [id]
    );
    if (stops.length < 3) return ok(res, { route_id: Number(id), flags: [], message: 'Not enough stops to evaluate detours' });

    const direct = stops[stops.length - 1].distance_from_origin_km;
    const flags = [];
    for (let i = 1; i < stops.length - 1; i++) {
      const evenShare = (direct / (stops.length - 1)) * i;
      if (stops[i].distance_from_origin_km > evenShare * OPTIMIZATION_DETOUR_THRESHOLD) {
        flags.push({
          stop_name: stops[i].stop_name,
          sequence_no: stops[i].sequence_no,
          actual_km: stops[i].distance_from_origin_km,
          expected_km: Number(evenShare.toFixed(2)),
          note: 'This stop adds significant detour distance relative to an even distribution — consider re-sequencing or reviewing necessity.'
        });
      }
    }
    return ok(res, { route_id: Number(id), flags });
  } catch (err) { next(err); }
}

module.exports = {
  listRoutes, getRoute, createRoute, updateRoute, updateRouteStatus,
  deleteRoute, routePerformance, routeOptimization
};
