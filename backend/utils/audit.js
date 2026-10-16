const pool = require('../config/db');

/**
 * Records an immutable audit trail entry for a state-changing action.
 * Never throws to the caller — audit logging failures should not block
 * the primary business operation, but they are logged to stderr.
 */
async function logAction({ userId, action, entityType, entityId, beforeState = null, afterState = null, ip = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_state, after_state, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        action,
        entityType,
        entityId || null,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState ? JSON.stringify(afterState) : null,
        ip
      ]
    );
  } catch (err) {
    console.error('Audit log failure:', err.message);
  }
}

module.exports = { logAction };
