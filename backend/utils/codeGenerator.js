/**
 * Generates a standardized, zero-padded code e.g. RT-0001, TR-0002, SOP-0001, SC-0003
 * Used for the human/system-readable identifiers referenced by other FMS modules.
 */
async function generateCode(pool, tableName, codeColumn, prefix, padding = 4) {
  const [rows] = await pool.query(
    `SELECT ${codeColumn} FROM ${tableName} ORDER BY ${codeColumn} DESC LIMIT 1`
  );
  let nextNumber = 1;
  if (rows.length > 0) {
    const lastCode = rows[0][codeColumn]; // e.g. "RT-0007"
    const numPart = parseInt(lastCode.split('-')[1], 10);
    if (!Number.isNaN(numPart)) nextNumber = numPart + 1;
  }
  return `${prefix}-${String(nextNumber).padStart(padding, '0')}`;
}

module.exports = { generateCode };
