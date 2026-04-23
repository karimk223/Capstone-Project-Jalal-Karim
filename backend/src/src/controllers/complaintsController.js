/**
 * Complaints controller.
 * Implements FR-5 (create), FR-6 (auto-status + tracking), FR-11 (transitions),
 * FR-12 (transition validation), FR-13 (reject requires comment), FR-14 (terminal
 * status guard), FR-16 (structured filters), FR-17 (pagination), FR-19/FR-20 (audit).
 *
 * Addresses Gap 1 (no status field), Gap 2 (no audit trail), Gap 4 (wildcard search),
 * Gap 6 (no dashboard/workflow), Gap 8 (year×pen partitioning).
 *
 * All SQL is parameterized. Column names match schema.sql exactly.
 */

const db = require('../config/db');
const ApiError = require('../utils/apiError');
const { recordTransition } = require('../services/trackingService');

// ── Allowed transitions map ─────────────────────────────────────────────────
// Implements FR-12: valid transitions defined in backend config, not in the UI.
// Key = from_status_id, Value = array of allowed to_status_id values.
// Addresses Gap 6 (workflow encoded implicitly in legacy referral tab).
const ALLOWED_TRANSITIONS = {
  1: [2],       // Submitted → Under Review
  2: [3, 5],    // Under Review → Pending Approval, or Rejected
  3: [4, 5, 2], // Pending Approval → Approved, Rejected, or back to Under Review
  4: [6, 7],    // Approved → Resolved, or Closed
  5: [],        // Rejected (terminal) — no transitions unless Admin reopens
  6: [7],       // Resolved → Closed
  7: [],        // Closed (terminal)
};

// Maps to_status_id to the APPROVALS.action ENUM value
const STATUS_TO_ACTION = {
  2: 'submitted',  // Under Review
  3: 'submitted',  // Pending Approval
  4: 'approved',
  5: 'rejected',
  6: 'approved',   // Resolved (follows approval)
  7: 'approved',   // Closed
};

/**
 * POST /complaints — Create a new complaint.
 * Implements FR-5, FR-6. Addresses Gap 1, Gap 2, Gap 8.
 *
 * Inserts into COMPLAINTS with status_id=1 (Submitted), then inserts the
 * initial TRACKING row with from_status_id=NULL, all in one transaction.
 */
async function create(req, res, next) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      title, description, category, priority,
      department_id, type_id, citizen_id,
      file_number, completion_deadline,
    } = req.body;

    // Default status is 1 (Submitted) — addresses Gap 1
    const statusId = 1;

    const [result] = await conn.execute(
      `INSERT INTO COMPLAINTS
         (submitted_by, citizen_id, status_id, department_id, type_id,
          title, description, category, priority, file_number, completion_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.staff_id,
        citizen_id || null,
        statusId,
        department_id || null,
        type_id || null,
        title,
        description,
        category,
        priority || 'Medium',
        file_number || null,
        completion_deadline || null,
      ]
    );

    const complaintId = result.insertId;

    // FR-6: initial TRACKING entry with from_status_id = NULL
    await recordTransition(conn, {
      complaintId,
      changedBy: req.user.staff_id,
      fromStatusId: null,
      toStatusId: statusId,
      notes: 'Complaint submitted.',
    });

    await conn.commit();

    return res.status(201).json({
      complaint_id: complaintId,
      status_id: statusId,
      status_name: 'Submitted',
      submitted_at: new Date().toISOString(),
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/**
 * GET /complaints — List complaints with structured filters.
 * Implements FR-16, FR-17. Addresses Gap 4 (no wildcards), Gap 8 (no year×pen lock).
 *
 * Filters: status_id, department_id, type_id, priority, date_from, date_to,
 *          citizen_national_id
 * Pagination: page, limit (default 20)
 * Sorting: sort_by (submitted_at | completion_deadline | priority), sort_dir (asc | desc)
 */
async function list(req, res, next) {
  try {
    const {
      status_id, department_id, type_id, priority,
      date_from, date_to, citizen_national_id,
      page = 1, limit = 20,
      sort_by = 'submitted_at', sort_dir = 'desc',
    } = req.query;

    // ── Build WHERE clauses from structured filters (Gap 4) ──────────────
    const conditions = [];
    const params = [];

    if (status_id) {
      conditions.push('c.status_id = ?');
      params.push(Number(status_id));
    }
    if (department_id) {
      conditions.push('c.department_id = ?');
      params.push(Number(department_id));
    }
    if (type_id) {
      conditions.push('c.type_id = ?');
      params.push(Number(type_id));
    }
    if (priority) {
      conditions.push('c.priority = ?');
      params.push(priority);
    }
    if (date_from) {
      conditions.push('c.submitted_at >= ?');
      params.push(date_from);
    }
    if (date_to) {
      conditions.push('c.submitted_at <= ?');
      params.push(date_to + ' 23:59:59');
    }
    if (citizen_national_id) {
      conditions.push('cit.national_id = ?');
      params.push(citizen_national_id);
    }

    // ── Role-based filtering (Gap 5) ─────────────────────────────────────
    // Clerks see only their own or their department's complaints.
    // Directors see their department. Ministers/Admins see everything.
    if (req.user.role_name === 'Clerk') {
      conditions.push('(c.submitted_by = ? OR c.department_id IN (SELECT department_id FROM COMPLAINTS WHERE submitted_by = ?))');
      params.push(req.user.staff_id, req.user.staff_id);
    }
    // Directors would be filtered by department_id once STAFF has a department_id column.
    // For MVP, Directors and above see all.

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // ── Validate sort column to prevent injection ────────────────────────
    const allowedSorts = ['submitted_at', 'completion_deadline', 'priority'];
    const safeSort = allowedSorts.includes(sort_by) ? sort_by : 'submitted_at';
    const safeDir = sort_dir === 'asc' ? 'ASC' : 'DESC';

    // ── Pagination ───────────────────────────────────────────────────────
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    // ── Count query ──────────────────────────────────────────────────────
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
         FROM COMPLAINTS c
         LEFT JOIN CITIZENS cit ON cit.citizen_id = c.citizen_id
         ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // ── Data query ───────────────────────────────────────────────────────
    const [rows] = await db.execute(
      `SELECT c.complaint_id, c.title, c.priority, c.submitted_at,
              c.completion_deadline, c.is_scanned,
              cs.status_name, cs.is_terminal,
              d.department_name,
              ct.type_name,
              s.full_name AS submitted_by_name,
              cit.full_name AS citizen_name
         FROM COMPLAINTS c
         JOIN COMPLAINT_STATUS cs ON cs.status_id = c.status_id
         LEFT JOIN DEPARTMENTS d  ON d.department_id = c.department_id
         LEFT JOIN COMPLAINT_TYPES ct ON ct.type_id = c.type_id
         JOIN STAFF s              ON s.staff_id = c.submitted_by
         LEFT JOIN CITIZENS cit    ON cit.citizen_id = c.citizen_id
         ${whereClause}
         ORDER BY c.${safeSort} ${safeDir}
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
 * GET /complaints/:id — Get a single complaint with all related data.
 * Implements FR-20. Returns complaint + attachments + approvals + tracking timeline.
 */
async function getById(req, res, next) {
  try {
    const { id } = req.params;

    // ── Main complaint ───────────────────────────────────────────────────
    const [rows] = await db.execute(
      `SELECT c.*,
              cs.status_name, cs.is_terminal,
              d.department_name,
              ct.type_name,
              s.full_name AS submitted_by_name,
              cit.full_name AS citizen_name, cit.national_id AS citizen_national_id,
              cit.phone_1 AS citizen_phone, cit.email AS citizen_email
         FROM COMPLAINTS c
         JOIN COMPLAINT_STATUS cs  ON cs.status_id = c.status_id
         LEFT JOIN DEPARTMENTS d   ON d.department_id = c.department_id
         LEFT JOIN COMPLAINT_TYPES ct ON ct.type_id = c.type_id
         JOIN STAFF s               ON s.staff_id = c.submitted_by
         LEFT JOIN CITIZENS cit     ON cit.citizen_id = c.citizen_id
        WHERE c.complaint_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return next(new ApiError(404, 'NOT_FOUND', 'Complaint not found.'));
    }

    const complaint = rows[0];

    // ── Attachments ──────────────────────────────────────────────────────
    const [attachments] = await db.execute(
      `SELECT a.attachment_id, a.file_name, a.mime_type, a.file_size_kb,
              a.uploaded_at, s.full_name AS uploaded_by_name
         FROM ATTACHMENTS a
         JOIN STAFF s ON s.staff_id = a.uploaded_by
        WHERE a.complaint_id = ?
        ORDER BY a.uploaded_at DESC`,
      [id]
    );

    // ── Approvals ────────────────────────────────────────────────────────
    const [approvals] = await db.execute(
      `SELECT ap.approval_id, ap.action, ap.comment, ap.action_at,
              s.full_name AS approver_name
         FROM APPROVALS ap
         JOIN STAFF s ON s.staff_id = ap.approver_id
        WHERE ap.complaint_id = ?
        ORDER BY ap.action_at DESC`,
      [id]
    );

    // ── Tracking timeline (Gap 2) ────────────────────────────────────────
    const [tracking] = await db.execute(
      `SELECT t.tracking_id,
              s1.status_name AS from_status_name,
              s2.status_name AS to_status_name,
              st.full_name AS changed_by_name,
              t.notes, t.changed_at
         FROM TRACKING t
         LEFT JOIN COMPLAINT_STATUS s1 ON s1.status_id = t.from_status_id
         JOIN COMPLAINT_STATUS s2      ON s2.status_id = t.to_status_id
         JOIN STAFF st                 ON st.staff_id = t.changed_by
        WHERE t.complaint_id = ?
        ORDER BY t.changed_at DESC`,
      [id]
    );

    return res.json({
      complaint,
      attachments,
      approvals,
      tracking,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /complaints/:id — Update editable fields (NOT status).
 * Auth: Submitting Clerk (while Submitted), Director, Admin.
 */
async function update(req, res, next) {
  try {
    const { id } = req.params;

    // Fetch current complaint to check ownership and status
    const [existing] = await db.execute(
      'SELECT complaint_id, submitted_by, status_id FROM COMPLAINTS WHERE complaint_id = ?',
      [id]
    );

    if (existing.length === 0) {
      return next(new ApiError(404, 'NOT_FOUND', 'Complaint not found.'));
    }

    const complaint = existing[0];

    // Clerks can only edit their own complaints while status = Submitted (1)
    if (req.user.role_name === 'Clerk') {
      if (complaint.submitted_by !== req.user.staff_id) {
        return next(new ApiError(403, 'FORBIDDEN_ROLE', 'You can only edit complaints you submitted.'));
      }
      if (complaint.status_id !== 1) {
        return next(new ApiError(400, 'INVALID_TRANSITION', 'Complaints can only be edited while in Submitted status.'));
      }
    }

    // ── Build dynamic SET clause from validated body ──────────────────────
    const updatableFields = [
      'title', 'description', 'priority', 'department_id',
      'type_id', 'citizen_id', 'completion_deadline',
    ];
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
      `UPDATE COMPLAINTS SET ${setClauses.join(', ')} WHERE complaint_id = ?`,
      params
    );

    return res.json({ message: 'Complaint updated.', complaint_id: Number(id) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /complaints/:id/transition — Change complaint status.
 * Implements FR-11, FR-12, FR-13, FR-14. Addresses Gap 1, Gap 2, Gap 6.
 *
 * Transactional: validates transition → inserts APPROVALS → inserts TRACKING
 * → updates COMPLAINTS.status_id. Rolls back on any failure (NFR-3).
 */
async function transition(req, res, next) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const { to_status_id, comment } = req.body;

    // Fetch current status
    const [existing] = await conn.execute(
      'SELECT complaint_id, status_id FROM COMPLAINTS WHERE complaint_id = ?',
      [id]
    );

    if (existing.length === 0) {
      await conn.rollback();
      return next(new ApiError(404, 'NOT_FOUND', 'Complaint not found.'));
    }

    const currentStatusId = existing[0].status_id;

    // FR-14: check if current status is terminal
    const [statusRows] = await conn.execute(
      'SELECT is_terminal FROM COMPLAINT_STATUS WHERE status_id = ?',
      [currentStatusId]
    );
    if (statusRows[0].is_terminal && req.user.role_name !== 'Admin') {
      await conn.rollback();
      return next(new ApiError(400, 'TERMINAL_STATUS',
        'This complaint is in a terminal status. Only an Admin can reopen it.'));
    }

    // FR-12: validate transition is allowed
    const allowed = ALLOWED_TRANSITIONS[currentStatusId] || [];
    if (!allowed.includes(to_status_id)) {
      await conn.rollback();
      return next(new ApiError(400, 'INVALID_TRANSITION',
        `Cannot transition from status ${currentStatusId} to ${to_status_id}.`));
    }

    // FR-13: rejecting requires a comment
    if (to_status_id === 5 && (!comment || comment.trim() === '')) {
      await conn.rollback();
      return next(new ApiError(400, 'VALIDATION_FAILED',
        'A comment is required when rejecting a complaint.'));
    }

    // ── Insert into APPROVALS ────────────────────────────────────────────
    const action = STATUS_TO_ACTION[to_status_id] || 'submitted';
    await conn.execute(
      `INSERT INTO APPROVALS (complaint_id, approver_id, action, comment)
       VALUES (?, ?, ?, ?)`,
      [id, req.user.staff_id, action, comment || null]
    );

    // ── Insert into TRACKING (Gap 2) ─────────────────────────────────────
    await recordTransition(conn, {
      complaintId: id,
      changedBy: req.user.staff_id,
      fromStatusId: currentStatusId,
      toStatusId: to_status_id,
      notes: comment,
    });

    // ── Update COMPLAINTS.status_id ──────────────────────────────────────
    // If transitioning to Resolved (6), also set resolved_at
    if (to_status_id === 6) {
      await conn.execute(
        'UPDATE COMPLAINTS SET status_id = ?, resolved_at = NOW() WHERE complaint_id = ?',
        [to_status_id, id]
      );
    } else {
      await conn.execute(
        'UPDATE COMPLAINTS SET status_id = ? WHERE complaint_id = ?',
        [to_status_id, id]
      );
    }

    await conn.commit();

    // Fetch status names for the response
    const [fromStatus] = await db.execute(
      'SELECT status_name FROM COMPLAINT_STATUS WHERE status_id = ?', [currentStatusId]
    );
    const [toStatus] = await db.execute(
      'SELECT status_name FROM COMPLAINT_STATUS WHERE status_id = ?', [to_status_id]
    );

    return res.json({
      complaint_id: Number(id),
      from_status: fromStatus[0].status_name,
      to_status: toStatus[0].status_name,
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
 * GET /complaints/:id/tracking — Full audit timeline for a complaint.
 * Implements FR-19, FR-20. Addresses Gap 2.
 * Append-only — no PATCH or DELETE on this endpoint.
 */
async function getTracking(req, res, next) {
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
      `SELECT t.tracking_id,
              s1.status_name AS from_status_name,
              s2.status_name AS to_status_name,
              st.full_name AS changed_by_name,
              t.notes, t.changed_at
         FROM TRACKING t
         LEFT JOIN COMPLAINT_STATUS s1 ON s1.status_id = t.from_status_id
         JOIN COMPLAINT_STATUS s2      ON s2.status_id = t.to_status_id
         JOIN STAFF st                 ON st.staff_id = t.changed_by
        WHERE t.complaint_id = ?
        ORDER BY t.changed_at DESC`,
      [id]
    );

    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update, transition, getTracking };
