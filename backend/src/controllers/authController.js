/**
 * Auth controller.
 * Implements FR-1 (login with bcrypt), FR-2 (JWT issuance), FR-4 (disabled
 * accounts blocked at login). Addresses Gap 5 (real server-side RBAC).
 *
 * All SQL is parameterized (coding-conventions.md §4.2); column names match
 * schema.sql exactly (STAFF.staff_id, STAFF.role_id, STAFF.email, etc.).
 */

const db = require('../config/db');
const ApiError = require('../utils/apiError');
const { verifyPassword, hashPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');

/**
 * POST /auth/login
 * Request:  { email, password }
 * Response: { token, staff: { staff_id, full_name, role_id, role_name } }
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // JOIN STAFF ↔ ROLES so we get role_name in one query — we need it for the JWT payload.
    const [rows] = await db.execute(
      `SELECT s.staff_id, s.full_name, s.email, s.password_hash, s.is_active,
              s.role_id, r.role_name
         FROM STAFF s
         JOIN ROLES r ON r.role_id = s.role_id
        WHERE s.email = ?
        LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      // Same message for "no such user" and "wrong password" — don't reveal which.
      return next(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'));
    }

    const user = rows[0];

    // FR-4: disabled accounts can't log in.
    if (!user.is_active) {
      return next(
        new ApiError(403, 'FORBIDDEN_ROLE', 'This account has been disabled. Please contact an administrator.')
      );
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return next(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'));
    }

    // JWT payload is the minimum needed for auth + RBAC. No email, no password hash.
    const token = signToken({
      staff_id: user.staff_id,
      role_id: user.role_id,
      role_name: user.role_name,
    });

    return res.json({
      token,
      staff: {
        staff_id: user.staff_id,
        full_name: user.full_name,
        role_id: user.role_id,
        role_name: user.role_name,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/logout
 * JWTs are stateless in the MVP — the client just discards the token.
 * This route exists so the frontend has a symmetric logout call.
 */
async function logout(req, res) {
  return res.json({ message: 'Logged out.' });
}

/**
 * GET /auth/me
 * Returns the current logged-in staff record (no password_hash).
 */
async function me(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT s.staff_id, s.full_name, s.email, s.is_active, s.created_at,
              s.role_id, r.role_name
         FROM STAFF s
         JOIN ROLES r ON r.role_id = s.role_id
        WHERE s.staff_id = ?
        LIMIT 1`,
      [req.user.staff_id]
    );

    if (rows.length === 0) {
      // Token was valid but the user no longer exists — treat as unauthenticated.
      return next(new ApiError(401, 'NOT_AUTHENTICATED', 'Account no longer exists.'));
    }

    return res.json({ staff: rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /admin/staff
 * Admin-only route that creates a new staff account (per api-spec.md §6).
 * Self-registration is intentionally not a public route.
 *
 * Request:  { full_name, email, password, role_id }
 * Response: 201 with the created staff row (no password_hash).
 */
async function createStaff(req, res, next) {
  try {
    const { full_name, email, password, role_id } = req.body;

    const password_hash = await hashPassword(password);

    // INSERT lets MySQL auto-increment staff_id; defaults for is_active and created_at.
    const [result] = await db.execute(
      `INSERT INTO STAFF (role_id, full_name, email, password_hash)
       VALUES (?, ?, ?, ?)`,
      [role_id, full_name, email, password_hash]
    );

    // Return the freshly-inserted row joined with role_name for the client.
    const [rows] = await db.execute(
      `SELECT s.staff_id, s.full_name, s.email, s.is_active, s.created_at,
              s.role_id, r.role_name
         FROM STAFF s
         JOIN ROLES r ON r.role_id = s.role_id
        WHERE s.staff_id = ?`,
      [result.insertId]
    );

    return res.status(201).json({ staff: rows[0] });
  } catch (err) {
    // ER_DUP_ENTRY on uq_staff_email is mapped to DUPLICATE_EMAIL by errorHandler.
    next(err);
  }
}
/**
 * POST /auth/change-password
 * Allows logged-in user to change their own password.
 * Verifies old password before updating.
 */
async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    const staffId = req.user.staff_id;

    const [rows] = await db.execute(
      'SELECT password_hash FROM STAFF WHERE staff_id = ? LIMIT 1',
      [staffId]
    );

    if (rows.length === 0) {
      return next(new ApiError(404, 'NOT_FOUND', 'User not found.'));
    }

    const ok = await verifyPassword(oldPassword, rows[0].password_hash);
    if (!ok) {
      return next(new ApiError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.'));
    }

    const newHash = await hashPassword(newPassword);
    await db.execute(
      'UPDATE STAFF SET password_hash = ? WHERE staff_id = ?',
      [newHash, staffId]
    );

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me, createStaff, changePassword };
