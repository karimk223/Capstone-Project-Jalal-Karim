/**
 * Admin controller — staff management + lookup table management.
 * Implements FR-1 (account creation), FR-4 (disable accounts),
 * FR-21 (Admin can deprecate lookup entries).
 * Addresses Gap 5 (server-side RBAC), Gap 9 (lookup management).
 *
 * B07: added createComplaintType, updateComplaintType,
 *      createReferralDestination, updateReferralDestination.
 */

const db = require('../config/db');
const ApiError = require('../utils/apiError');

/** GET /admin/staff — List all staff members (no password_hash). */
async function listStaff(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT s.staff_id, s.full_name, s.email, s.is_active, s.created_at,
              s.role_id, r.role_name
         FROM STAFF s
         JOIN ROLES r ON r.role_id = s.role_id
        ORDER BY s.staff_id ASC`
    );
    return res.json({ data: rows });
  } catch (err) { next(err); }
}

/** PATCH /admin/staff/:id — Update name, role, or is_active. */
async function updateStaff(req, res, next) {
  try {
    const { id } = req.params;
    const [existing] = await db.execute(
      'SELECT staff_id FROM STAFF WHERE staff_id = ?', [id]
    );
    if (existing.length === 0) {
      return next(new ApiError(404, 'NOT_FOUND', 'Staff member not found.'));
    }

    const updatableFields = ['full_name', 'email', 'role_id', 'is_active'];
    const setClauses = [];
    const params = [];

    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }

    if (setClauses.length === 0) {
      return next(new ApiError(400, 'VALIDATION_FAILED', 'No updatable fields provided.'));
    }

    params.push(id);
    await db.execute(
      `UPDATE STAFF SET ${setClauses.join(', ')} WHERE staff_id = ?`, params
    );

    const [rows] = await db.execute(
      `SELECT s.staff_id, s.full_name, s.email, s.is_active, s.created_at,
              s.role_id, r.role_name
         FROM STAFF s JOIN ROLES r ON r.role_id = s.role_id
        WHERE s.staff_id = ?`,
      [id]
    );
    return res.json({ staff: rows[0] });
  } catch (err) { next(err); }
}

// ── Lookup table management (B07 — FR-21) ──────────────────────────────────

/** POST /admin/complaint-types — Create a new complaint type. */
async function createComplaintType(req, res, next) {
  try {
    const { type_name } = req.body;
    if (!type_name || !type_name.trim()) {
      return next(new ApiError(400, 'VALIDATION_FAILED', 'type_name is required.'));
    }
    const [result] = await db.execute(
      'INSERT INTO COMPLAINT_TYPES (type_name, is_deprecated) VALUES (?, 0)',
      [type_name.trim()]
    );
    const [rows] = await db.execute(
      'SELECT type_id, type_name, is_deprecated FROM COMPLAINT_TYPES WHERE type_id = ?',
      [result.insertId]
    );
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

/** PATCH /admin/complaint-types/:id — Update or deprecate a complaint type. */
async function updateComplaintType(req, res, next) {
  try {
    const { id } = req.params;
    const { type_name, is_deprecated } = req.body;

    const [existing] = await db.execute(
      'SELECT type_id FROM COMPLAINT_TYPES WHERE type_id = ?', [id]
    );
    if (existing.length === 0) {
      return next(new ApiError(404, 'NOT_FOUND', 'Complaint type not found.'));
    }

    const setClauses = [];
    const params = [];
    if (type_name    !== undefined) { setClauses.push('type_name = ?');    params.push(type_name); }
    if (is_deprecated !== undefined) { setClauses.push('is_deprecated = ?'); params.push(is_deprecated ? 1 : 0); }

    if (setClauses.length === 0) {
      return next(new ApiError(400, 'VALIDATION_FAILED', 'No updatable fields provided.'));
    }

    params.push(id);
    await db.execute(`UPDATE COMPLAINT_TYPES SET ${setClauses.join(', ')} WHERE type_id = ?`, params);

    const [rows] = await db.execute(
      'SELECT type_id, type_name, is_deprecated FROM COMPLAINT_TYPES WHERE type_id = ?', [id]
    );
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

/** POST /admin/referral-destinations — Create a new referral destination. */
async function createReferralDestination(req, res, next) {
  try {
    const { destination_name, category, personal_contact } = req.body;

    const VALID_CATEGORIES = [
      'MUNICIPALITY','UNION','COMMITTEE','NGO',
      'INTERNATIONAL_ORG','PRIVATE_COMPANY','GOVERNMENT_DIRECTORATE','ACTION',
    ];

    if (!destination_name || !destination_name.trim()) {
      return next(new ApiError(400, 'VALIDATION_FAILED', 'destination_name is required.'));
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return next(new ApiError(400, 'VALIDATION_FAILED', `category must be one of: ${VALID_CATEGORIES.join(', ')}.`));
    }

    const [result] = await db.execute(
      'INSERT INTO REFERRAL_DESTINATIONS (destination_name, category, personal_contact, is_deprecated) VALUES (?, ?, ?, 0)',
      [destination_name.trim(), category, personal_contact || null]
    );
    const [rows] = await db.execute(
      'SELECT destination_id, destination_name, category, personal_contact, is_deprecated FROM REFERRAL_DESTINATIONS WHERE destination_id = ?',
      [result.insertId]
    );
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

/** PATCH /admin/referral-destinations/:id — Update or deprecate a destination. */
async function updateReferralDestination(req, res, next) {
  try {
    const { id } = req.params;
    const { destination_name, is_deprecated } = req.body;

    const [existing] = await db.execute(
      'SELECT destination_id FROM REFERRAL_DESTINATIONS WHERE destination_id = ?', [id]
    );
    if (existing.length === 0) {
      return next(new ApiError(404, 'NOT_FOUND', 'Referral destination not found.'));
    }

    const setClauses = [];
    const params = [];
    if (destination_name !== undefined) { setClauses.push('destination_name = ?'); params.push(destination_name); }
    if (is_deprecated    !== undefined) { setClauses.push('is_deprecated = ?');    params.push(is_deprecated ? 1 : 0); }

    if (setClauses.length === 0) {
      return next(new ApiError(400, 'VALIDATION_FAILED', 'No updatable fields provided.'));
    }

    params.push(id);
    await db.execute(`UPDATE REFERRAL_DESTINATIONS SET ${setClauses.join(', ')} WHERE destination_id = ?`, params);

    const [rows] = await db.execute(
      'SELECT destination_id, destination_name, category, personal_contact, is_deprecated FROM REFERRAL_DESTINATIONS WHERE destination_id = ?',
      [id]
    );
    return res.json(rows[0]);
  } catch (err) { next(err); }
}

module.exports = {
  listStaff, updateStaff,
  createComplaintType, updateComplaintType,
  createReferralDestination, updateReferralDestination,
};
