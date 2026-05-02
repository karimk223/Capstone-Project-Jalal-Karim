/**
 * src/controllers/lookupsController.js
 * Serves reference data for frontend dropdowns and filters.
 * All queries are parameterized and read-only.
 * Addresses Gap 9 (categorized lookups) and Gap 4 (structured filters).
 *
 * B07/B08 additions:
 *   - getComplaintTypes now accepts ?include_deprecated=true for Admin use
 *   - getReferralDestinations added (was missing entirely)
 */

const db = require('../config/db');

/** GET /api/v1/lookups/statuses */
async function getStatuses(req, res, next) {
  try {
    const [rows] = await db.execute(
      'SELECT status_id, status_name, is_terminal FROM COMPLAINT_STATUS ORDER BY status_id'
    );
    res.json(rows);
  } catch (err) { next(err); }
}

/** GET /api/v1/lookups/departments */
async function getDepartments(req, res, next) {
  try {
    const [rows] = await db.execute(
      'SELECT department_id, department_name AS name, pen_code FROM DEPARTMENTS WHERE is_active = 1 ORDER BY department_name'
    );
    res.json(rows);
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/lookups/complaint-types
 * Pass ?include_deprecated=true to get all entries (Admin lookup-management page).
 * Default hides deprecated and near-duplicate (canonical_id not null) entries.
 */
async function getComplaintTypes(req, res, next) {
  try {
    const includeDeprecated = req.query.include_deprecated === 'true';

    const [rows] = await db.execute(
      includeDeprecated
        ? `SELECT type_id, type_name, canonical_id, is_deprecated
           FROM COMPLAINT_TYPES ORDER BY type_name`
        : `SELECT type_id, type_name, canonical_id, is_deprecated
           FROM COMPLAINT_TYPES
           WHERE is_deprecated = 0 AND canonical_id IS NULL
           ORDER BY type_name`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

/** GET /api/v1/lookups/roles */
async function getRoles(req, res, next) {
  try {
    const [rows] = await db.execute(
      'SELECT role_id, role_name FROM ROLES ORDER BY role_id'
    );
    res.json(rows);
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/lookups/referral-destinations
 * Implements FR-22 — grouped by category.
 * Pass ?include_deprecated=true for the Admin lookup-management page.
 * Pass ?category=MUNICIPALITY to filter to one category.
 */
async function getReferralDestinations(req, res, next) {
  try {
    const includeDeprecated = req.query.include_deprecated === 'true';
    const categoryFilter    = req.query.category || null;

    const conditions = [];
    const params     = [];

    if (!includeDeprecated) {
      conditions.push('is_deprecated = 0');
    }
    if (categoryFilter) {
      conditions.push('category = ?');
      params.push(categoryFilter);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await db.execute(
      `SELECT destination_id, destination_name, category, personal_contact, is_deprecated
       FROM REFERRAL_DESTINATIONS
       ${where}
       ORDER BY category, destination_name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { getStatuses, getDepartments, getComplaintTypes, getRoles, getReferralDestinations };
