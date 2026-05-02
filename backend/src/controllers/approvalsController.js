/**
 * Approvals controller.
 * Implements FR-11 (workflow transitions), FR-13 (reject requires comment),
 * FR-15 (pending approvals for Directors/Ministers dashboard).
 * Addresses Gap 2 (audit trail) and Gap 6 (no dashboard/workflow).
 *
 * Note: The core transition logic lives in complaintsController.transition().
 * This controller adds approval-specific views (pending list, history) and
 * convenience endpoints for approve/reject that delegate to the same
 * transactional pattern.
 *
 * All SQL is parameterized. Column names match schema.sql exactly.
 */

const db = require('../config/db');
const ApiError = require('../utils/apiError');
const { recordTransition } = require('../services/trackingService');

/**
 * GET /approvals/pending — List complaints awaiting approval.
 * Implements FR-15. Addresses Gap 6 (no "my work" view in legacy system).
 *
 * Returns complaints with status_id = 3 (Pending Approval).
 * Directors see only their department; Ministers/Admins see all.
 */
async function listPending(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    // status_id = 3 is "Pending Approval" per COMPLAINT_STATUS seed
    const conditions = ['c.status_id = 3'];
    const params = [];

    // Role-based filtering: Clerks shouldn't be here (RBAC blocks them),
    // but Directors see only their department's complaints.
    // For MVP, Directors see all pending (STAFF doesn't have department_id yet).

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
         FROM COMPLAINTS c
         ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await db.execute(
      `SELECT c.complaint_id, c.title, c.priority, c.submitted_at,
              c.completion_deadline, c.category,
              cs.status_name,
              d.department_name,
              s.full_name AS submitted_by_name
         FROM COMPLAINTS c
         JOIN COMPLAINT_STATUS cs ON cs.status_id = c.status_id
         LEFT JOIN DEPARTMENTS d  ON d.department_id = c.department_id
         JOIN STAFF s              ON s.staff_id = c.submitted_by
         ${whereClause}
         ORDER BY c.submitted_at ASC
         LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    return res.json({
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /approvals/complaint/:id — Get approval history for a specific complaint.
 * Returns all APPROVALS rows for this complaint, newest first.
 */
async function getByComplaint(req, res, next) {
  try {
    const { id } = req.params;

    // Verify complaint exists
    const [exists] = await db.execute(
      'SELECT complaint_id FROM COMPLAINTS WHERE complaint_id = ?',
      [id]
    );
    if (exists.length === 0) {
      return next(new ApiError(404, 'NOT_FOUND', 'Complaint not found.'));
    }

    const [rows] = await db.execute(
      `SELECT ap.approval_id, ap.action, ap.comment, ap.action_at,
              s.full_name AS approver_name, s.role_id
         FROM APPROVALS ap
         JOIN STAFF s ON s.staff_id = ap.approver_id
        WHERE ap.complaint_id = ?
        ORDER BY ap.action_at DESC`,
      [id]
    );

    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /approvals/:id/approve — Approve a complaint.
 * Convenience endpoint: transitions status to 4 (Approved).
 * Implements FR-11. Addresses Gap 1, Gap 2, Gap 6.
 *
 * The complaint must be in status 3 (Pending Approval) to be approved.
 * Comment is optional for approvals (FR-13).
 */
async function approve(req, res, next) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const { comment } = req.body;

    // Fetch current complaint
    const [existing] = await conn.execute(
      'SELECT complaint_id, status_id FROM COMPLAINTS WHERE complaint_id = ?',
      [id]
    );
    if (existing.length === 0) {
      await conn.rollback();
      return next(new ApiError(404, 'NOT_FOUND', 'Complaint not found.'));
    }

    const currentStatusId = existing[0].status_id;

    // Must be in Pending Approval (3) to approve
    if (currentStatusId !== 3) {
      await conn.rollback();
      return next(new ApiError(400, 'INVALID_TRANSITION',
        'Only complaints in "Pending Approval" status can be approved.'));
    }

    const toStatusId = 4; // Approved

    // Insert into APPROVALS
    await conn.execute(
      `INSERT INTO APPROVALS (complaint_id, approver_id, action, comment)
       VALUES (?, ?, 'approved', ?)`,
      [id, req.user.staff_id, comment || null]
    );

    // Insert into TRACKING (Gap 2)
    await recordTransition(conn, {
      complaintId: id,
      changedBy: req.user.staff_id,
      fromStatusId: currentStatusId,
      toStatusId,
      notes: comment || 'Complaint approved.',
    });

    // Update complaint status
    await conn.execute(
      'UPDATE COMPLAINTS SET status_id = ? WHERE complaint_id = ?',
      [toStatusId, id]
    );

    await conn.commit();

    return res.json({
      complaint_id: Number(id),
      action: 'approved',
      from_status: 'Pending Approval',
      to_status: 'Approved',
      changed_at: new Date().toISOString(),
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/**
 * POST /approvals/:id/reject — Reject a complaint.
 * Convenience endpoint: transitions status to 5 (Rejected).
 * Implements FR-11, FR-13 (comment required for rejections).
 * Addresses Gap 1, Gap 2, Gap 6.
 *
 * The complaint must be in status 2 (Under Review) or 3 (Pending Approval).
 */
async function reject(req, res, next) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const { comment } = req.body;

    // FR-13: rejecting requires a comment
    if (!comment || comment.trim() === '') {
      await conn.rollback();
      return next(new ApiError(400, 'VALIDATION_FAILED',
        'A comment is required when rejecting a complaint.'));
    }

    // Fetch current complaint
    const [existing] = await conn.execute(
      'SELECT complaint_id, status_id FROM COMPLAINTS WHERE complaint_id = ?',
      [id]
    );
    if (existing.length === 0) {
      await conn.rollback();
      return next(new ApiError(404, 'NOT_FOUND', 'Complaint not found.'));
    }

    const currentStatusId = existing[0].status_id;

    // Can reject from Under Review (2) or Pending Approval (3)
    if (currentStatusId !== 2 && currentStatusId !== 3) {
      await conn.rollback();
      return next(new ApiError(400, 'INVALID_TRANSITION',
        'Only complaints in "Under Review" or "Pending Approval" status can be rejected.'));
    }

    const toStatusId = 5; // Rejected

    // Insert into APPROVALS
    await conn.execute(
      `INSERT INTO APPROVALS (complaint_id, approver_id, action, comment)
       VALUES (?, ?, 'rejected', ?)`,
      [id, req.user.staff_id, comment]
    );

    // Insert into TRACKING (Gap 2)
    await recordTransition(conn, {
      complaintId: id,
      changedBy: req.user.staff_id,
      fromStatusId: currentStatusId,
      toStatusId,
      notes: comment,
    });

    // Update complaint status
    await conn.execute(
      'UPDATE COMPLAINTS SET status_id = ? WHERE complaint_id = ?',
      [toStatusId, id]
    );

    await conn.commit();

    return res.json({
      complaint_id: Number(id),
      action: 'rejected',
      from_status: currentStatusId === 2 ? 'Under Review' : 'Pending Approval',
      to_status: 'Rejected',
      changed_at: new Date().toISOString(),
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

module.exports = { listPending, getByComplaint, approve, reject };
