/**
 * src/controllers/dashboardController.js
 * Implements FR-15 (role-specific dashboard counts).
 * Addresses Gap 6 (no summary view) and Gap 1 (no status field).
 *
 * Role IDs match schema.sql ROLES seed:
 *   1 = Admin    2 = Clerk    3 = Director    4 = Minister
 */

const db = require('../config/db');

const ROLE = { ADMIN: 1, CLERK: 2, DIRECTOR: 3, MINISTER: 4 };

async function getSummary(req, res, next) {
  try {
    const { staff_id, role_id } = req.user;

    let counts = {};
    let recentActivity = [];

    // ── Clerk: counts scoped to complaints they submitted ──────────────────
    if (role_id === ROLE.CLERK) {

      const [[openRow]] = await db.execute(
        `SELECT COUNT(*) AS my_open
         FROM COMPLAINTS c
         JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
         WHERE c.submitted_by = ? AND cs.is_terminal = 0`,
        [staff_id]
      );

      const [[overdueRow]] = await db.execute(
        `SELECT COUNT(*) AS my_overdue
         FROM COMPLAINTS c
         JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
         WHERE c.submitted_by = ?
           AND cs.is_terminal = 0
           AND c.completion_deadline IS NOT NULL
           AND c.completion_deadline < CURDATE()`,
        [staff_id]
      );

      const [[monthRow]] = await db.execute(
        `SELECT COUNT(*) AS my_submitted_this_month
         FROM COMPLAINTS
         WHERE submitted_by = ?
           AND MONTH(submitted_at) = MONTH(CURDATE())
           AND YEAR(submitted_at)  = YEAR(CURDATE())`,
        [staff_id]
      );

      counts = {
        my_open:                 openRow.my_open,
        my_overdue:              overdueRow.my_overdue,
        my_submitted_this_month: monthRow.my_submitted_this_month,
      };

      [recentActivity] = await db.execute(
        `SELECT t.tracking_id, t.notes, t.changed_at, t.complaint_id,
                cs_to.status_name   AS to_status,
                cs_from.status_name AS from_status,
                s.full_name         AS changed_by_name
         FROM TRACKING t
         JOIN COMPLAINTS c           ON t.complaint_id    = c.complaint_id
         JOIN COMPLAINT_STATUS cs_to ON t.to_status_id    = cs_to.status_id
         LEFT JOIN COMPLAINT_STATUS cs_from ON t.from_status_id = cs_from.status_id
         JOIN STAFF s                ON t.changed_by      = s.staff_id
         WHERE c.submitted_by = ?
         ORDER BY t.changed_at DESC
         LIMIT 5`,
        [staff_id]
      );
    }

    // ── Director: all complaints ───────────────────────────────────────────
    else if (role_id === ROLE.DIRECTOR) {

      const [[openRow]] = await db.execute(
        `SELECT COUNT(*) AS total_open
         FROM COMPLAINTS c
         JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
         WHERE cs.is_terminal = 0`
      );

      const [[pendingRow]] = await db.execute(
        `SELECT COUNT(*) AS pending_approvals FROM COMPLAINTS WHERE status_id = 3`
      );

      const [[overdueRow]] = await db.execute(
        `SELECT COUNT(*) AS total_overdue
         FROM COMPLAINTS c
         JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
         WHERE cs.is_terminal = 0
           AND c.completion_deadline IS NOT NULL
           AND c.completion_deadline < CURDATE()`
      );

      counts = {
        total_open:        openRow.total_open,
        pending_approvals: pendingRow.pending_approvals,
        total_overdue:     overdueRow.total_overdue,
      };

      [recentActivity] = await db.execute(
        `SELECT t.tracking_id, t.notes, t.changed_at, t.complaint_id,
                cs_to.status_name   AS to_status,
                cs_from.status_name AS from_status,
                s.full_name         AS changed_by_name
         FROM TRACKING t
         JOIN COMPLAINT_STATUS cs_to ON t.to_status_id = cs_to.status_id
         LEFT JOIN COMPLAINT_STATUS cs_from ON t.from_status_id = cs_from.status_id
         JOIN STAFF s ON t.changed_by = s.staff_id
         ORDER BY t.changed_at DESC
         LIMIT 5`
      );
    }

    // ── Minister / Admin: system-wide ─────────────────────────────────────
    else {

      const [[totalRow]] = await db.execute(
        `SELECT COUNT(*) AS total_complaints FROM COMPLAINTS`
      );

      const [[openRow]] = await db.execute(
        `SELECT COUNT(*) AS total_open
         FROM COMPLAINTS c
         JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
         WHERE cs.is_terminal = 0`
      );

      const [[pendingRow]] = await db.execute(
        `SELECT COUNT(*) AS pending_approvals FROM COMPLAINTS WHERE status_id = 3`
      );

      const [[overdueRow]] = await db.execute(
        `SELECT COUNT(*) AS total_overdue
         FROM COMPLAINTS c
         JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
         WHERE cs.is_terminal = 0
           AND c.completion_deadline IS NOT NULL
           AND c.completion_deadline < CURDATE()`
      );

      const [[resolvedRow]] = await db.execute(
        `SELECT COUNT(*) AS resolved_this_month
         FROM COMPLAINTS
         WHERE resolved_at IS NOT NULL
           AND MONTH(resolved_at) = MONTH(CURDATE())
           AND YEAR(resolved_at)  = YEAR(CURDATE())`
      );

      counts = {
        total_complaints:    totalRow.total_complaints,
        total_open:          openRow.total_open,
        pending_approvals:   pendingRow.pending_approvals,
        total_overdue:       overdueRow.total_overdue,
        resolved_this_month: resolvedRow.resolved_this_month,
      };

      [recentActivity] = await db.execute(
        `SELECT t.tracking_id, t.notes, t.changed_at, t.complaint_id,
                cs_to.status_name   AS to_status,
                cs_from.status_name AS from_status,
                s.full_name         AS changed_by_name
         FROM TRACKING t
         JOIN COMPLAINT_STATUS cs_to ON t.to_status_id = cs_to.status_id
         LEFT JOIN COMPLAINT_STATUS cs_from ON t.from_status_id = cs_from.status_id
         JOIN STAFF s ON t.changed_by = s.staff_id
         ORDER BY t.changed_at DESC
         LIMIT 5`
      );
    }

    return res.json({ role_id, counts, recent_activity: recentActivity });

  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary };
