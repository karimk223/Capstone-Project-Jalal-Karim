/**
 * Reports controller â€” analytics endpoints.
 * Implements FR-15 (dashboard). Addresses Gap 6 (no dashboard/reports in legacy).
 *
 * GET /reports/counts-by-status
 * GET /reports/counts-by-category
 * GET /reports/average-resolution-time
 * GET /reports/complaints-per-staff
 *
 * All routes accessible by any authenticated user; role-based filtering applied.
 */

const db = require('../config/db');

/**
 * GET /reports/counts-by-status â€” Complaint counts grouped by status.
 */
async function countsByStatus(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT cs.status_name, COUNT(*) AS count
         FROM COMPLAINTS c
         JOIN COMPLAINT_STATUS cs ON cs.status_id = c.status_id
        GROUP BY c.status_id, cs.status_name
        ORDER BY c.status_id ASC`
    );
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /reports/counts-by-category â€” Complaint counts grouped by category.
 */
async function countsByCategory(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT category, COUNT(*) AS count
         FROM COMPLAINTS
        GROUP BY category
        ORDER BY count DESC`
    );
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /reports/average-resolution-time â€” Average days from submitted_at to resolved_at.
 * Only counts complaints with status_id = 6 (Resolved).
 */
async function averageResolutionTime(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT AVG(DATEDIFF(resolved_at, submitted_at)) AS avg_days
         FROM COMPLAINTS
        WHERE status_id = 6 AND resolved_at IS NOT NULL`
    );
    const avgDays = rows[0].avg_days ? Math.round(rows[0].avg_days * 10) / 10 : null;
    return res.json({ average_resolution_days: avgDays });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /reports/complaints-per-staff â€” Count of complaints per staff member.
 */
async function complaintsPerStaff(req, res, next) {
  try {
    const [rows] = await db.execute(
      `SELECT s.full_name, s.role_id, r.role_name, COUNT(c.complaint_id) AS complaint_count
         FROM STAFF s
         JOIN ROLES r ON r.role_id = s.role_id
         LEFT JOIN COMPLAINTS c ON c.submitted_by = s.staff_id
        GROUP BY s.staff_id, s.full_name, s.role_id, r.role_name
        ORDER BY complaint_count DESC`
    );
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { countsByStatus, countsByCategory, averageResolutionTime, complaintsPerStaff };
