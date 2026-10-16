const pool = require('../config/db');
const { ok, created, fail, notFound } = require('../utils/response');
const { generateCode } = require('../utils/codeGenerator');
const { logAction } = require('../utils/audit');

function computeTotal(base_rate, additional_charges = 0, fuel_surcharge = 0) {
  return Number(base_rate) + Number(additional_charges) + Number(fuel_surcharge);
}

async function listTariffs(req, res, next) {
  try {
    const { status, service_type, vehicle_type, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (service_type) { where.push('service_type = ?'); params.push(service_type); }
    if (vehicle_type) { where.push('vehicle_type = ?'); params.push(vehicle_type); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(
      `SELECT * FROM tariffs ${whereClause} ORDER BY date_created DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM tariffs ${whereClause}`, params);

    return ok(res, rows, { page: Number(page), limit: Number(limit), total: countRows[0].total });
  } catch (err) { next(err); }
}

async function getTariff(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM tariffs WHERE tariff_id = ?', [req.params.id]);
    if (rows.length === 0) return notFound(res, 'Tariff');
    return ok(res, rows[0]);
  } catch (err) { next(err); }
}

async function createTariff(req, res, next) {
  try {
    const {
      service_type, vehicle_type, weight_min_kg, weight_max_kg,
      distance_min_km, distance_max_km, base_rate,
      additional_charges = 0, fuel_surcharge = 0, effective_date, expiration_date = null
    } = req.body;

    if (!service_type || !vehicle_type || base_rate == null || !effective_date) {
      return fail(res, 'service_type, vehicle_type, base_rate, and effective_date are required', 400);
    }

    const tariff_code = await generateCode(pool, 'tariffs', 'tariff_code', 'TR');

    const [result] = await pool.query(
      `INSERT INTO tariffs (tariff_code, service_type, vehicle_type, weight_min_kg, weight_max_kg,
        distance_min_km, distance_max_km, base_rate, additional_charges, fuel_surcharge,
        effective_date, expiration_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`,
      [tariff_code, service_type, vehicle_type, weight_min_kg, weight_max_kg, distance_min_km,
       distance_max_km, base_rate, additional_charges, fuel_surcharge, effective_date, expiration_date, req.user.user_id]
    );

    await logAction({ userId: req.user.user_id, action: 'CREATE_TARIFF', entityType: 'TARIFF', entityId: result.insertId, afterState: req.body });

    return created(res, {
      tariff_id: result.insertId,
      tariff_code,
      total_freight_cost_preview: computeTotal(base_rate, additional_charges, fuel_surcharge)
    });
  } catch (err) { next(err); }
}

async function updateTariff(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const [existingRows] = await pool.query('SELECT * FROM tariffs WHERE tariff_id = ?', [id]);
    if (existingRows.length === 0) return notFound(res, 'Tariff');
    const existing = existingRows[0];

    await conn.beginTransaction();

    // Snapshot into history before applying changes to an Approved tariff
    if (existing.status === 'Approved') {
      await conn.query(
        `INSERT INTO tariff_history (tariff_id, snapshot_json, changed_by, change_reason)
         VALUES (?, ?, ?, ?)`,
        [id, JSON.stringify(existing), req.user.user_id, 'Update to approved tariff']
      );
    }

    const fields = ['service_type', 'vehicle_type', 'weight_min_kg', 'weight_max_kg',
      'distance_min_km', 'distance_max_km', 'base_rate', 'additional_charges',
      'fuel_surcharge', 'effective_date', 'expiration_date'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (updates.length) {
      params.push(id);
      await conn.query(`UPDATE tariffs SET ${updates.join(', ')} WHERE tariff_id = ?`, params);
    }

    await conn.commit();
    await logAction({ userId: req.user.user_id, action: 'UPDATE_TARIFF', entityType: 'TARIFF', entityId: id, beforeState: existing, afterState: req.body });

    return ok(res, { tariff_id: Number(id) });
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
      const [rows] = await pool.query('SELECT status FROM tariffs WHERE tariff_id = ?', [id]);
      if (rows.length === 0) return notFound(res, 'Tariff');
      if (allowedFrom && !allowedFrom.includes(rows[0].status)) {
        return fail(res, `Cannot move tariff from '${rows[0].status}' to '${newStatus}'`, 409);
      }

      const approverField = newStatus === 'Approved' ? ', approved_by = ?' : '';
      const params = approverField ? [newStatus, req.user.user_id, id] : [newStatus, id];
      await pool.query(`UPDATE tariffs SET status = ?${approverField} WHERE tariff_id = ?`, params);

      await logAction({
        userId: req.user.user_id, action: `TARIFF_${newStatus.toUpperCase().replace(' ', '_')}`,
        entityType: 'TARIFF', entityId: id, beforeState: { status: rows[0].status }, afterState: { status: newStatus }
      });

      return ok(res, { tariff_id: Number(id), status: newStatus });
    } catch (err) { next(err); }
  };
}

async function getHistory(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM tariff_history WHERE tariff_id = ? ORDER BY date_recorded DESC`, [req.params.id]
    );
    return ok(res, rows);
  } catch (err) { next(err); }
}

async function quote(req, res, next) {
  try {
    const { service_type, vehicle_type, weight_kg, distance_km } = req.body;
    if (!service_type || !vehicle_type || weight_kg == null || distance_km == null) {
      return fail(res, 'service_type, vehicle_type, weight_kg, and distance_km are required', 400);
    }

    const [rows] = await pool.query(
      `SELECT * FROM tariffs
       WHERE service_type = ? AND vehicle_type = ? AND status = 'Approved'
         AND ? BETWEEN weight_min_kg AND weight_max_kg
         AND ? BETWEEN distance_min_km AND distance_max_km
       ORDER BY effective_date DESC LIMIT 1`,
      [service_type, vehicle_type, weight_kg, distance_km]
    );

    if (rows.length === 0) return fail(res, 'No matching approved tariff found for the given parameters', 404);

    return ok(res, {
      tariff_id: rows[0].tariff_id,
      tariff_code: rows[0].tariff_code,
      base_rate: rows[0].base_rate,
      fuel_surcharge: rows[0].fuel_surcharge,
      additional_charges: rows[0].additional_charges,
      total_freight_cost: rows[0].total_freight_cost
    });
  } catch (err) { next(err); }
}

module.exports = {
  listTariffs, getTariff, createTariff, updateTariff, getHistory, quote,
  submit: changeStatus('Pending Approval', ['Draft', 'Rejected']),
  approve: changeStatus('Approved', ['Pending Approval']),
  reject: changeStatus('Rejected', ['Pending Approval']),
  archive: changeStatus('Archived', ['Approved', 'Rejected'])
};
