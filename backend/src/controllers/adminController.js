/**
 * Admin controller â€” staff management (CRUD).
 * Implements FR-1 (account creation), FR-4 (disable accounts).
 * Addresses Gap 5 (server-side RBAC).
 *
 * createStaff lives in authController.js (reused here via route wiring).
 * This file adds: listStaff, updateStaff.
 *
 * All SQL parameterized. Column names match schema.sql STAFF table.
 */

const db = require('../config/db');
const ApiError = require('../utils/apiError');
const { hashPassword } = require('../utils/password');

/**
 * GET /admin/staff â€” List all staff members.
 * Returns staff with role_name joined, no password_hash exposed.
 */
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
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /admin/staff/:id â€” Update staff name, role, or is_active.
 * Implements FR-4 (disable accounts without deletion).
 *
 * Updatable fields: full_name, email, role_id, is_active.
 * Password changes go through a separate route (not in MVP scope).
 */
async function updateStaff(req, res, next) {
  try {
    const { id } = req.params;

    // Verify staff exists
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
      `UPDATE STAFF SET ${setClauses.join(', ')} WHERE staff_id = ?`,
      params
    );

    // Return the updated row
    const [rows] = await db.execute(
      `SELECT s.staff_id, s.full_name, s.email, s.is_active, s.created_at,
              s.role_id, r.role_name
         FROM STAFF s
         JOIN ROLES r ON r.role_id = s.role_id
        WHERE s.staff_id = ?`,
      [id]
    );

    return res.json({ staff: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listStaff, updateStaff };
