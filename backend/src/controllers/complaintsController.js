const db = require('../config/db');

const ROLE = { ADMIN: 1, CLERK: 2, DIRECTOR: 3, MINISTER: 4 };

function roleName(req) {
  return String(req.user?.role_name || '').trim();
}

function generateFileNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const stamp = String(Date.now()).slice(-8);
  const random = Math.floor(Math.random() * 900 + 100);

  return `MIN-${year}-${stamp}${random}`;
}

function duplicateFileNumberResponse(res) {
  return res.status(409).json({
    code: 'DUPLICATE_FILE_NUMBER',
    message: 'A complaint with this file number already exists.',
  });
}

function deriveAction(toStatusId) {
  if (Number(toStatusId) === 5) return 'rejected';
  if (Number(toStatusId) === 4) return 'approved';
  return 'submitted';
}

function applySharedFilters(query, conditions, params, user) {
  const {
    search,
    department_id,
    type_id,
    priority,
    date_from,
    date_to,
    citizen_national_id,
    file_number,
    overdue,
    resolved_this_month,
    my_submitted,
  } = query;

  if (department_id) {
    conditions.push('c.department_id = ?');
    params.push(parseInt(department_id, 10));
  }

  if (type_id) {
    conditions.push('c.type_id = ?');
    params.push(parseInt(type_id, 10));
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
    params.push(date_to);
  }

  if (citizen_national_id) {
    conditions.push('ci.national_id = ?');
    params.push(citizen_national_id);
  }

  if (file_number) {
    conditions.push('c.file_number = ?');
    params.push(file_number);
  }

  if (search && search.trim()) {
    conditions.push('(ci.national_id LIKE ? OR c.file_number LIKE ?)');
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  if (my_submitted === '1' || my_submitted === 'true') {
    conditions.push('c.submitted_by = ?');
    params.push(Number(user.staff_id));
  }

  if (overdue === '1' || overdue === 'true') {
    conditions.push(`cs.is_terminal = 0`);
    conditions.push(`c.completion_deadline IS NOT NULL`);
    conditions.push(`c.completion_deadline < CURDATE()`);
  }

  if (resolved_this_month === '1' || resolved_this_month === 'true') {
    conditions.push(`c.resolved_at IS NOT NULL`);
    conditions.push(`MONTH(c.resolved_at) = MONTH(CURDATE())`);
    conditions.push(`YEAR(c.resolved_at) = YEAR(CURDATE())`);
  }
}

async function getLatestDecision(conn, complaintId) {
  const [rows] = await conn.execute(
    `SELECT ap.approval_id,
            ap.approver_id,
            ap.action,
            ap.action_at,
            s.role_id,
            r.role_name
     FROM APPROVALS ap
     JOIN STAFF s ON ap.approver_id = s.staff_id
     JOIN ROLES r ON s.role_id = r.role_id
     WHERE ap.complaint_id = ?
       AND ap.action IN ('approved', 'rejected')
     ORDER BY ap.action_at DESC, ap.approval_id DESC
     LIMIT 1`,
    [complaintId]
  );

  return rows[0] || null;
}

async function canTransitionComplaint({ conn, complaint, req, toStatusId }) {
  const role = roleName(req);
  const roleId = Number(req.user.role_id);
  const staffId = Number(req.user.staff_id);
  const fromStatusId = Number(complaint.status_id);
  const submittedBy = Number(complaint.submitted_by);
  const isOwner = submittedBy === staffId;

  if (roleId === ROLE.ADMIN || role === 'Admin') {
    return {
      allowed: false,
      code: 'ADMIN_WORKFLOW_FORBIDDEN',
      message:
        'Admins manage users and lookup tables, but cannot change complaint workflow status.',
    };
  }

  if (fromStatusId === toStatusId) {
    return {
      allowed: false,
      code: 'SAME_STATUS',
      message: `The complaint is already in "${complaint.status_name}".`,
    };
  }

  const latestDecision = await getLatestDecision(conn, complaint.complaint_id);
  const latestDecisionByMinister =
    latestDecision && Number(latestDecision.role_id) === ROLE.MINISTER;

  if (role === 'Clerk') {
    if (!isOwner) {
      return {
        allowed: false,
        code: 'FORBIDDEN_OWNER',
        message:
          'Clerks can only change workflow status for complaints they submitted.',
      };
    }

    const clerkAllowed = {
      1: [2],
      2: [3],
      4: [6],
      5: [1],
      6: [7],
    };

    if ((clerkAllowed[fromStatusId] || []).includes(toStatusId)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      code: 'INVALID_CLERK_TRANSITION',
      message:
        'This workflow action is not available for clerks. Clerks can move their own complaints through review steps, return rejected complaints to Submitted, and close approved/resolved work.',
    };
  }

  if (role === 'Director') {
    if (latestDecisionByMinister && [4, 5].includes(toStatusId)) {
      return {
        allowed: false,
        code: 'MINISTER_DECISION_LOCKED',
        message:
          'A Minister decision already exists. Directors cannot override or change a Minister decision.',
      };
    }

    const directorAllowed = {
      1: [2],
      2: [3],
      3: [4, 5],
      4: [5, 6],
      5: [1, 4],
      6: [7],
    };

    if ((directorAllowed[fromStatusId] || []).includes(toStatusId)) {
      if ([4, 5].includes(fromStatusId) && [4, 5].includes(toStatusId)) {
        if (!latestDecision || Number(latestDecision.approver_id) !== staffId) {
          return {
            allowed: false,
            code: 'DIRECTOR_DECISION_FORBIDDEN',
            message:
              'Directors can only edit their own approval/rejection decision, and cannot change another user’s decision.',
          };
        }
      }

      return { allowed: true };
    }

    return {
      allowed: false,
      code: 'INVALID_DIRECTOR_TRANSITION',
      message:
        'This workflow transition is not allowed for Directors from the current status.',
    };
  }

  if (role === 'Minister') {
    const ministerAllowed = {
      1: [2, 4, 5],
      2: [3, 4, 5],
      3: [4, 5],
      4: [5, 6],
      5: [1, 4],
      6: [4, 5, 7],
      7: [4, 5],
    };

    if ((ministerAllowed[fromStatusId] || []).includes(toStatusId)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      code: 'INVALID_MINISTER_TRANSITION',
      message:
        'This workflow transition is not allowed for Ministers from the current status.',
    };
  }

  return {
    allowed: false,
    code: 'FORBIDDEN_ROLE',
    message: 'You do not have permission to perform this workflow action.',
  };
}

function canEditComplaint({ complaint, req }) {
  const role = roleName(req);
  const roleId = Number(req.user.role_id);
  const staffId = Number(req.user.staff_id);
  const statusId = Number(complaint.status_id);
  const isOwner = Number(complaint.submitted_by) === staffId;

  if (roleId === ROLE.ADMIN || role === 'Admin') {
    return {
      allowed: false,
      code: 'ADMIN_EDIT_FORBIDDEN',
      message:
        'Admins manage system users and lookup tables, but cannot edit complaint details.',
    };
  }

  if (role === 'Clerk') {
    if (!isOwner) {
      return {
        allowed: false,
        code: 'FORBIDDEN_OWNER',
        message: 'Clerks can only edit complaints they submitted.',
      };
    }

    if (![1, 5].includes(statusId)) {
      return {
        allowed: false,
        code: 'INVALID_EDIT_STATUS',
        message:
          'Clerks can edit their complaint only while it is Submitted or Rejected. If it was rejected, return it to Submitted and add the new supporting details.',
      };
    }

    return { allowed: true };
  }

  if (role === 'Director') {
    if ([7].includes(statusId)) {
      return {
        allowed: false,
        code: 'CLOSED_EDIT_FORBIDDEN',
        message: 'Directors cannot edit a Closed complaint.',
      };
    }

    return { allowed: true };
  }

  if (role === 'Minister') {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: 'FORBIDDEN_ROLE',
    message: 'You do not have permission to edit this complaint.',
  };
}

exports.list = async (req, res) => {
  try {
    const {
      status_id,
      open,
      page = 1,
      limit = 20,
      sort_by = 'submitted_at',
      sort_dir = 'desc',
    } = req.query;

    const SAFE_SORT = ['submitted_at', 'completion_deadline', 'priority'];
    const safeSort = SAFE_SORT.includes(sort_by) ? sort_by : 'submitted_at';
    const safeSortDir = sort_dir === 'asc' ? 'ASC' : 'DESC';

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (safePage - 1) * safeLimit;

    const params = [];
    const conditions = ['1=1'];

    applySharedFilters(req.query, conditions, params, req.user);

    if (status_id) {
      conditions.push('c.status_id = ?');
      params.push(parseInt(status_id, 10));
    }

    if (open === '1' || open === 'true') {
      conditions.push('cs.is_terminal = 0');
    }

    const where = conditions.join(' AND ');

    const statusCountParams = [];
    const statusCountConditions = ['1=1'];

    applySharedFilters(req.query, statusCountConditions, statusCountParams, req.user);

    const statusCountWhere = statusCountConditions.join(' AND ');

    const [statusCounts] = await db.execute(
      `SELECT cs.status_id,
              cs.status_name,
              COUNT(c.complaint_id) AS count
       FROM COMPLAINT_STATUS cs
       LEFT JOIN COMPLAINTS c ON c.status_id = cs.status_id
       LEFT JOIN CITIZENS ci ON c.citizen_id = ci.citizen_id
       WHERE ${statusCountWhere}
       GROUP BY cs.status_id, cs.status_name
       ORDER BY cs.status_id ASC`,
      statusCountParams
    );

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM COMPLAINTS c
       JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
       LEFT JOIN CITIZENS ci ON c.citizen_id = ci.citizen_id
       WHERE ${where}`,
      params
    );

    const [rows] = await db.execute(
      `SELECT c.complaint_id,
              c.file_number,
              c.title,
              c.priority,
              c.submitted_at,
              c.completion_deadline,
              cs.status_name,
              d.department_name,
              ct.type_name,
              s.full_name AS submitted_by_name,
              ci.full_name AS citizen_name,
              ci.national_id AS citizen_national_id,
              ap.action AS decision_action,
              ap.action_at AS decision_at,
              approver.full_name AS decision_by_name,
              approver_role.role_name AS decision_by_role
       FROM COMPLAINTS c
       JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
       JOIN DEPARTMENTS d ON c.department_id = d.department_id
       JOIN COMPLAINT_TYPES ct ON c.type_id = ct.type_id
       LEFT JOIN STAFF s ON c.submitted_by = s.staff_id
       LEFT JOIN CITIZENS ci ON c.citizen_id = ci.citizen_id
       LEFT JOIN APPROVALS ap
         ON ap.approval_id = (
           SELECT ap2.approval_id
           FROM APPROVALS ap2
           WHERE ap2.complaint_id = c.complaint_id
             AND ap2.action IN ('approved', 'rejected')
           ORDER BY ap2.action_at DESC, ap2.approval_id DESC
           LIMIT 1
         )
       LEFT JOIN STAFF approver ON ap.approver_id = approver.staff_id
       LEFT JOIN ROLES approver_role ON approver.role_id = approver_role.role_id
       WHERE ${where}
       ORDER BY c.${safeSort} ${safeSortDir}
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );

    return res.json({
      data: rows,
      status_counts: statusCounts.map((row) => ({
        ...row,
        count: Number(row.count),
      })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: countRows[0].total,
        totalPages: Math.ceil(countRows[0].total / safeLimit),
      },
    });
  } catch (err) {
    console.error('complaintsController.list error:', err);

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch complaints.',
    });
  }
};

exports.getById = async (req, res) => {
  try {
    const complaintId = parseInt(req.params.id, 10);

    const [rows] = await db.execute(
      `SELECT c.*,
              cs.status_name,
              cs.is_terminal,
              d.department_name,
              ct.type_name,
              s.full_name AS submitted_by_name,
              ci.full_name AS citizen_name,
              ci.national_id AS citizen_national_id,
              ci.phone_1 AS citizen_phone,
              ci.email AS citizen_email
       FROM COMPLAINTS c
       JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
       JOIN DEPARTMENTS d ON c.department_id = d.department_id
       JOIN COMPLAINT_TYPES ct ON c.type_id = ct.type_id
       LEFT JOIN STAFF s ON c.submitted_by = s.staff_id
       LEFT JOIN CITIZENS ci ON c.citizen_id = ci.citizen_id
       WHERE c.complaint_id = ?`,
      [complaintId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Complaint not found.',
      });
    }

    const [attachments] = await db.execute(
      `SELECT a.*, s.full_name AS uploaded_by_name
       FROM ATTACHMENTS a
       LEFT JOIN STAFF s ON a.uploaded_by = s.staff_id
       WHERE a.complaint_id = ?
       ORDER BY a.uploaded_at ASC`,
      [complaintId]
    );

    const [tracking] = await db.execute(
      `SELECT t.tracking_id,
              t.notes,
              t.changed_at,
              fs.status_name AS from_status_name,
              ts.status_name AS to_status_name,
              s.full_name AS changed_by_name
       FROM TRACKING t
       LEFT JOIN COMPLAINT_STATUS fs ON t.from_status_id = fs.status_id
       JOIN COMPLAINT_STATUS ts ON t.to_status_id = ts.status_id
       JOIN STAFF s ON t.changed_by = s.staff_id
       WHERE t.complaint_id = ?
       ORDER BY t.changed_at DESC`,
      [complaintId]
    );

    const [approvals] = await db.execute(
      `SELECT ap.*,
              s.full_name AS approver_name,
              r.role_name AS approver_role
       FROM APPROVALS ap
       JOIN STAFF s ON ap.approver_id = s.staff_id
       JOIN ROLES r ON s.role_id = r.role_id
       WHERE ap.complaint_id = ?
       ORDER BY ap.action_at DESC, ap.approval_id DESC`,
      [complaintId]
    );

    return res.json({ ...rows[0], attachments, tracking, approvals });
  } catch (err) {
    console.error('complaintsController.getById error:', err);

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch complaint.',
    });
  }
};

exports.create = async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const {
      title,
      description,
      category,
      priority,
      department_id,
      type_id,
      citizen_id,
      completion_deadline,
      file_number,
    } = req.body;

    const submittedBy = req.user.staff_id;
    const cleanedFileNumber = file_number?.trim() || generateFileNumber();

    const [result] = await conn.execute(
      `INSERT INTO COMPLAINTS
         (submitted_by, status_id, title, description, category,
          priority, department_id, type_id, citizen_id, completion_deadline,
          file_number, submitted_at)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        submittedBy,
        title.trim(),
        description.trim(),
        category.trim(),
        priority,
        department_id,
        type_id,
        citizen_id || null,
        completion_deadline || null,
        cleanedFileNumber,
      ]
    );

    await conn.execute(
      `INSERT INTO TRACKING
         (complaint_id, changed_by, from_status_id, to_status_id, notes, changed_at)
       VALUES (?, ?, NULL, 1, 'Complaint submitted.', NOW())`,
      [result.insertId, submittedBy]
    );

    await conn.commit();

    return res.status(201).json({
      complaint_id: result.insertId,
      file_number: cleanedFileNumber,
      status_id: 1,
      status_name: 'Submitted',
      submitted_at: new Date().toISOString(),
    });
  } catch (err) {
    await conn.rollback();

    console.error('complaintsController.create error:', err);

    if (
      err.code === 'ER_DUP_ENTRY' &&
      err.message.includes('uq_complaints_file_number')
    ) {
      return duplicateFileNumberResponse(res);
    }

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create complaint.',
    });
  } finally {
    conn.release();
  }
};

exports.update = async (req, res) => {
  try {
    const complaintId = parseInt(req.params.id, 10);

    const [rows] = await db.execute(
      `SELECT c.complaint_id,
              c.submitted_by,
              c.status_id,
              cs.status_name
       FROM COMPLAINTS c
       JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
       WHERE c.complaint_id = ?`,
      [complaintId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Complaint not found.',
      });
    }

    const permission = canEditComplaint({ complaint: rows[0], req });

    if (!permission.allowed) {
      return res.status(403).json({
        code: permission.code,
        message: permission.message,
      });
    }

    const {
      title,
      description,
      category,
      priority,
      completion_deadline,
      department_id,
      type_id,
      citizen_id,
    } = req.body;

    const setParts = [];
    const params = [];

    if (title !== undefined) {
      setParts.push('title = ?');
      params.push(title.trim());
    }

    if (description !== undefined) {
      setParts.push('description = ?');
      params.push(description.trim());
    }

    if (category !== undefined) {
      setParts.push('category = ?');
      params.push(category.trim());
    }

    if (priority !== undefined) {
      setParts.push('priority = ?');
      params.push(priority);
    }

    if (completion_deadline !== undefined) {
      setParts.push('completion_deadline = ?');
      params.push(completion_deadline || null);
    }

    if (department_id !== undefined) {
      setParts.push('department_id = ?');
      params.push(department_id);
    }

    if (type_id !== undefined) {
      setParts.push('type_id = ?');
      params.push(type_id);
    }

    if (citizen_id !== undefined) {
      setParts.push('citizen_id = ?');
      params.push(citizen_id || null);
    }

    if (setParts.length === 0) {
      return res.status(400).json({
        code: 'VALIDATION_FAILED',
        message: 'No fields were provided to update.',
      });
    }

    params.push(complaintId);

    await db.execute(
      `UPDATE COMPLAINTS SET ${setParts.join(', ')} WHERE complaint_id = ?`,
      params
    );

    return res.json({ message: 'Complaint updated.' });
  } catch (err) {
    console.error('complaintsController.update error:', err);

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update complaint.',
    });
  }
};

exports.transition = async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const complaintId = parseInt(req.params.id, 10);
    const { to_status_id, comment } = req.body;
    const staffId = req.user.staff_id;
    const toStatusId = parseInt(to_status_id, 10);

    const [rows] = await conn.execute(
      `SELECT c.complaint_id,
              c.submitted_by,
              c.status_id,
              cs.status_name
       FROM COMPLAINTS c
       JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
       WHERE c.complaint_id = ?`,
      [complaintId]
    );

    if (rows.length === 0) {
      await conn.rollback();

      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Complaint not found.',
      });
    }

    const complaint = rows[0];

    const [targetRows] = await conn.execute(
      'SELECT status_name FROM COMPLAINT_STATUS WHERE status_id = ?',
      [toStatusId]
    );

    if (targetRows.length === 0) {
      await conn.rollback();

      return res.status(400).json({
        code: 'INVALID_STATUS',
        message: 'Target status does not exist.',
      });
    }

    const toStatusName = targetRows[0].status_name;

    const permission = await canTransitionComplaint({
      conn,
      complaint,
      req,
      toStatusId,
    });

    if (!permission.allowed) {
      await conn.rollback();

      return res.status(403).json({
        code: permission.code,
        message: permission.message,
      });
    }

    if (toStatusId === 5 && (!comment || !comment.trim())) {
      await conn.rollback();

      return res.status(400).json({
        code: 'VALIDATION_FAILED',
        message: 'A comment is required when rejecting a complaint.',
      });
    }

    if ([4, 5].includes(toStatusId)) {
      await conn.execute(
        `INSERT INTO APPROVALS
           (complaint_id, approver_id, action, comment, action_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [complaintId, staffId, deriveAction(toStatusId), comment || null]
      );
    }

    await conn.execute(
      `INSERT INTO TRACKING
         (complaint_id, changed_by, from_status_id, to_status_id, notes, changed_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [complaintId, staffId, complaint.status_id, toStatusId, comment || null]
    );

    let resolvedAtSql = '';
    if (toStatusId === 6) {
      resolvedAtSql = ', resolved_at = NOW()';
    }

    if ([1, 2, 3, 4, 5].includes(toStatusId)) {
      resolvedAtSql = ', resolved_at = NULL';
    }

    await conn.execute(
      `UPDATE COMPLAINTS SET status_id = ? ${resolvedAtSql} WHERE complaint_id = ?`,
      [toStatusId, complaintId]
    );

    await conn.commit();

    return res.json({
      complaint_id: complaintId,
      from_status: complaint.status_name,
      to_status: toStatusName,
      changed_at: new Date().toISOString(),
    });
  } catch (err) {
    await conn.rollback();

    console.error('complaintsController.transition error:', err);

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to transition complaint.',
    });
  } finally {
    conn.release();
  }
};

exports.getTracking = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT t.tracking_id,
              t.notes,
              t.changed_at,
              fs.status_name AS from_status_name,
              ts.status_name AS to_status_name,
              s.full_name AS changed_by_name
       FROM TRACKING t
       LEFT JOIN COMPLAINT_STATUS fs ON t.from_status_id = fs.status_id
       JOIN COMPLAINT_STATUS ts ON t.to_status_id = ts.status_id
       JOIN STAFF s ON t.changed_by = s.staff_id
       WHERE t.complaint_id = ?
       ORDER BY t.changed_at DESC`,
      [parseInt(req.params.id, 10)]
    );

    return res.json(rows);
  } catch (err) {
    console.error('complaintsController.getTracking error:', err);

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch tracking.',
    });
  }
};