/**
 * src/controllers/citizensController.js
 * Implements FR-9 (search/link citizen), FR-10 (duplicate national_id error).
 * Addresses Gap 10 (no de-duplicated applicant record in legacy system).
 */

const db = require('../config/db');
const ApiError = require('../utils/apiError');

/**
 * GET /citizens?q=<query>
 * Searches by full_name (LIKE) or exact national_id match.
 * Returns up to 20 results. No SQL wildcards exposed to the user.
 */
async function search(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const [rows] = await db.execute(
      `SELECT citizen_id, national_id, full_name, phone_1, email, address
       FROM CITIZENS
       WHERE national_id = ? OR full_name LIKE ?
       ORDER BY full_name
       LIMIT 20`,
      [q, `%${q}%`]
    );
    return res.json(rows);
  } catch (err) { next(err); }
}

/**
 * POST /citizens
 * Creates a new citizen record. Returns 409 on duplicate national_id.
 */
async function create(req, res, next) {
  try {
    const { national_id, full_name, phone_1, phone_2, email, address } = req.body;

    if (!national_id || !national_id.trim()) {
      return next(new ApiError(400, 'VALIDATION_FAILED', 'national_id is required.'));
    }
    if (!full_name || !full_name.trim()) {
      return next(new ApiError(400, 'VALIDATION_FAILED', 'full_name is required.'));
    }

    const [result] = await db.execute(
      `INSERT INTO CITIZENS (national_id, full_name, phone_1, phone_2, email, address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [national_id.trim(), full_name.trim(), phone_1 || null, phone_2 || null, email || null, address || null]
    );

    const [rows] = await db.execute(
      'SELECT citizen_id, national_id, full_name, phone_1, email, address FROM CITIZENS WHERE citizen_id = ?',
      [result.insertId]
    );
    return res.status(201).json(rows[0]);

  } catch (err) {
    // MySQL error 1062 = duplicate entry (unique key violation)
    if (err.code === 'ER_DUP_ENTRY') {
      return next(new ApiError(409, 'DUPLICATE_NATIONAL_ID', 'A citizen with this national ID already exists.'));
    }
    next(err);
  }
}

module.exports = { search, create };
