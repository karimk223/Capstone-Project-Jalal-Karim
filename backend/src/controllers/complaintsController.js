const db = require('../config/db');

const ROLE = { ADMIN: 1, CLERK: 2, DIRECTOR: 3, MINISTER: 4 };

const ALLOWED_TRANSITIONS = {
  1: [2, 5], // Submitted -> Under Review OR Rejected
  2: [3, 5], // Under Review -> Pending Approval OR Rejected
  3: [4, 5], // Pending Approval -> Approved OR Rejected
  4: [6], // Approved -> Resolved
  6: [7], // Resolved -> Closed
};

function deriveAction(toStatusId) {
  if (toStatusId === 5) return 'rejected';
  if (toStatusId === 4) return 'approved';
  return 'submitted';
}

function buildInvalidTransitionMessage({
  fromStatusId,
  fromStatusName,
  toStatusId,
  toStatusName,
  allowedNextNames,
}) {
  if (Number(toStatusId) === Number(fromStatusId)) {
    return `The complaint is already in "${fromStatusName}".`;
  }

  if (Number(toStatusId) < Number(fromStatusId)) {
    return `Cannot change from "${fromStatusName}" back to "${toStatusName}". You cannot move to a previous state.`;
  }

  if (!allowedNextNames || allowedNextNames.length === 0) {
    return `Cannot change from "${fromStatusName}" to "${toStatusName}". No further transitions are allowed from this state.`;
  }

  if (allowedNextNames.length === 1) {
    return `Cannot change from "${fromStatusName}" to "${toStatusName}". You must change to "${allowedNextNames[0]}" first.`;
  }

  return `Cannot change from "${fromStatusName}" to "${toStatusName}". Allowed next statuses are: ${allowedNextNames.join(', ')}.`;
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

function applySharedFilters(query, conditions, params) {
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

    applySharedFilters(req.query, conditions, params);

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

    applySharedFilters(req.query, statusCountConditions, statusCountParams);

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
              ci.national_id AS citizen_national_id
       FROM COMPLAINTS c
       JOIN COMPLAINT_STATUS cs ON c.status_id = cs.status_id
       JOIN DEPARTMENTS d ON c.department_id = d.department_id
       JOIN COMPLAINT_TYPES ct ON c.type_id = ct.type_id
       LEFT JOIN STAFF s ON c.submitted_by = s.staff_id
       LEFT JOIN CITIZENS ci ON c.citizen_id = ci.citizen_id
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
      `SELECT ap.*, s.full_name AS approver_name
       FROM APPROVALS ap
       JOIN STAFF s ON ap.approver_id = s.staff_id
       WHERE ap.complaint_id = ?
       ORDER BY ap.action_at DESC`,
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
    const roleId = req.user.role_id;
    const staffId = req.user.staff_id;

    const [rows] = await db.execute(
      'SELECT submitted_by FROM COMPLAINTS WHERE complaint_id = ?',
      [complaintId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Complaint not found.',
      });
    }

    const isOwner = roleId === ROLE.CLERK && rows[0].submitted_by === staffId;
    const isPrivileged = [ROLE.DIRECTOR, ROLE.MINISTER, ROLE.ADMIN].includes(roleId);

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({
        code: 'FORBIDDEN_ROLE',
        message: 'You cannot edit this complaint.',
      });
    }

    const {
      title,
      description,
      priority,
      completion_deadline,
      department_id,
      type_id,
      citizen_id,
      file_number,
    } = req.body;

    const setParts = [];
    const params = [];

    if (title !== undefined) {
      setParts.push('title = ?');
      params.push(title);
    }

    if (description !== undefined) {
      setParts.push('description = ?');
      params.push(description);
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

    if (file_number !== undefined) {
      setParts.push('file_number = ?');
      params.push(file_number.trim());
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

    if (
      err.code === 'ER_DUP_ENTRY' &&
      err.message.includes('uq_complaints_file_number')
    ) {
      return duplicateFileNumberResponse(res);
    }

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
    const roleId = req.user.role_id;
    const staffId = req.user.staff_id;
    const toStatusId = parseInt(to_status_id, 10);

    const [rows] = await conn.execute(
      `SELECT c.status_id, cs.is_terminal, cs.status_name
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

    const {
      status_id: fromStatusId,
      is_terminal,
      status_name: fromStatusName,
    } = rows[0];

    if (is_terminal && roleId !== ROLE.ADMIN) {
      await conn.rollback();

      return res.status(400).json({
        code: 'TERMINAL_STATUS',
        message: `Complaint is in a terminal status (${fromStatusName}) and cannot be transitioned.`,
      });
    }

    const [targetRows] = await conn.execute(
      'SELECT status_name FROM COMPLAINT_STATUS WHERE status_id = ?',
      [toStatusId]
    );

    const toStatusName = targetRows[0]?.status_name || `status ${toStatusId}`;

    const allowedNext = ALLOWED_TRANSITIONS[fromStatusId] || [];

    let allowedNextNames = [];
    if (allowedNext.length > 0) {
      const placeholders = allowedNext.map(() => '?').join(', ');

      const [allowedRows] = await conn.execute(
        `SELECT status_id, status_name
         FROM COMPLAINT_STATUS
         WHERE status_id IN (${placeholders})`,
        allowedNext
      );

      const allowedNameMap = new Map(
        allowedRows.map((row) => [Number(row.status_id), row.status_name])
      );

      allowedNextNames = allowedNext
        .map((statusId) => allowedNameMap.get(Number(statusId)))
        .filter(Boolean);
    }

    if (!allowedNext.includes(toStatusId)) {
      await conn.rollback();

      return res.status(400).json({
        code: 'INVALID_TRANSITION',
        message: buildInvalidTransitionMessage({
          fromStatusId,
          fromStatusName,
          toStatusId,
          toStatusName,
          allowedNextNames,
        }),
      });
    }

    if (toStatusId === 5 && (!comment || !comment.trim())) {
      await conn.rollback();

      return res.status(400).json({
        code: 'VALIDATION_FAILED',
        message: 'A comment is required when rejecting a complaint.',
      });
    }

    await conn.execute(
      `INSERT INTO APPROVALS
         (complaint_id, approver_id, action, comment, action_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        complaintId,
        staffId,
        deriveAction(toStatusId),
        comment || null,
      ]
    );

    await conn.execute(
      `INSERT INTO TRACKING
         (complaint_id, changed_by, from_status_id, to_status_id, notes, changed_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        complaintId,
        staffId,
        fromStatusId,
        toStatusId,
        comment || null,
      ]
    );

    const resolvedAt = toStatusId === 6 ? ', resolved_at = NOW()' : '';

    await conn.execute(
      `UPDATE COMPLAINTS SET status_id = ? ${resolvedAt} WHERE complaint_id = ?`,
      [toStatusId, complaintId]
    );

    await conn.commit();

    return res.json({
      complaint_id: complaintId,
      from_status: fromStatusName,
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