/**
 * Unit tests for the complaints controller.
 * Verifies the B01/B02 fix (RBAC filter), invalid transitions (FR-12),
 * and reject-requires-comment (FR-13).
 *
 * The DB module is mocked so tests run without a real MySQL connection.
 */

// Mock the db pool BEFORE requiring the controller
jest.mock('../../src/config/db', () => ({
  execute: jest.fn(),
  getConnection: jest.fn(),
}));

const db = require('../../src/config/db');
const ctrl = require('../../src/controllers/complaintsController');

// Helper: build a fake express res
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// Helper: build a fake mysql connection for transactional routes
function mockConn() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(),
    execute: jest.fn(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('complaintsController.getById — RBAC fix (B01/B02)', () => {
  test('Director can fetch any complaint (no department filter applied)', async () => {
    // First call: complaint row. Then attachments, tracking, approvals (empty).
    db.execute
      .mockResolvedValueOnce([[{ complaint_id: 5, title: 'Pothole', status_name: 'Submitted' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const req = { params: { id: '5' }, user: { role_id: 3, staff_id: 99 } }; // Director
    const res = mockRes();

    await ctrl.getById(req, res);

    // The first SQL call should NOT contain a submitted_by filter for Directors
    const firstSql = db.execute.mock.calls[0][0];
    expect(firstSql).not.toMatch(/submitted_by\s*=\s*\?/);
    expect(res.json).toHaveBeenCalled();
  });

  test('Clerk gets ownership filter applied', async () => {
    db.execute.mockResolvedValueOnce([[]]); // no row -> 404

    const req = { params: { id: '5' }, user: { role_id: 2, staff_id: 99 } }; // Clerk
    const res = mockRes();

    await ctrl.getById(req, res);

    const firstSql = db.execute.mock.calls[0][0];
    expect(firstSql).toMatch(/submitted_by\s*=\s*\?/);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 404 when complaint does not exist', async () => {
    db.execute.mockResolvedValueOnce([[]]);

    const req = { params: { id: '999' }, user: { role_id: 1, staff_id: 1 } }; // Admin
    const res = mockRes();

    await ctrl.getById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_FOUND' })
    );
  });
});

describe('complaintsController.transition — workflow rules', () => {
  test('rejects invalid transition (Submitted → Approved)', async () => {
    const conn = mockConn();
    db.getConnection.mockResolvedValue(conn);
    // Current complaint is at status 1 (Submitted)
    conn.execute.mockResolvedValueOnce([[
      { status_id: 1, is_terminal: 0, status_name: 'Submitted' },
    ]]);

    const req = {
      params: { id: '5' },
      body:   { to_status_id: 4, comment: '' }, // 4 = Approved (illegal jump)
      user:   { role_id: 3, staff_id: 99 },
    };
    const res = mockRes();

    await ctrl.transition(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_TRANSITION' })
    );
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('rejection without a comment is blocked (FR-13)', async () => {
    const conn = mockConn();
    db.getConnection.mockResolvedValue(conn);
    conn.execute.mockResolvedValueOnce([[
      { status_id: 1, is_terminal: 0, status_name: 'Submitted' },
    ]]);

    const req = {
      params: { id: '5' },
      body:   { to_status_id: 5, comment: '   ' }, // 5 = Rejected, blank comment
      user:   { role_id: 3, staff_id: 99 },
    };
    const res = mockRes();

    await ctrl.transition(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_FAILED' })
    );
  });

  test('terminal status cannot be transitioned by non-admin (FR-14)', async () => {
    const conn = mockConn();
    db.getConnection.mockResolvedValue(conn);
    conn.execute.mockResolvedValueOnce([[
      { status_id: 6, is_terminal: 1, status_name: 'Resolved' },
    ]]);

    const req = {
      params: { id: '5' },
      body:   { to_status_id: 7, comment: '' },
      user:   { role_id: 3, staff_id: 99 }, // Director, not Admin
    };
    const res = mockRes();

    await ctrl.transition(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TERMINAL_STATUS' })
    );
  });

  test('valid transition writes to APPROVALS and TRACKING then commits', async () => {
    const conn = mockConn();
    db.getConnection.mockResolvedValue(conn);
    conn.execute
      .mockResolvedValueOnce([[ { status_id: 1, is_terminal: 0, status_name: 'Submitted' } ]]) // current
      .mockResolvedValueOnce([[ { status_name: 'Under Review' } ]])  // target name
      .mockResolvedValueOnce([{}])  // INSERT APPROVALS
      .mockResolvedValueOnce([{}])  // INSERT TRACKING
      .mockResolvedValueOnce([{}]); // UPDATE COMPLAINTS

    const req = {
      params: { id: '5' },
      body:   { to_status_id: 2, comment: 'Looking into it.' },
      user:   { role_id: 3, staff_id: 99 },
    };
    const res = mockRes();

    await ctrl.transition(req, res);

    expect(conn.commit).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ from_status: 'Submitted', to_status: 'Under Review' })
    );
  });
});
