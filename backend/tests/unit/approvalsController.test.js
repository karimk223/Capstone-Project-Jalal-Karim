/**
 * Unit tests for approvalsController.
 * Verifies FR-11 (transitions), FR-13 (reject requires comment),
 * FR-15 (pending approvals queue).
 */

jest.mock('../../src/config/db', () => ({
  execute: jest.fn(),
  getConnection: jest.fn(),
}));
jest.mock('../../src/services/trackingService', () => ({
  recordTransition: jest.fn().mockResolvedValue(),
}));

const db = require('../../src/config/db');
const { recordTransition } = require('../../src/services/trackingService');
const ctrl = require('../../src/controllers/approvalsController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

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

describe('approvalsController.listPending — FR-15', () => {
  test('returns paginated list of complaints at status 3 (Pending Approval)', async () => {
    db.execute
      .mockResolvedValueOnce([[{ total: 2 }]])
      .mockResolvedValueOnce([[
        { complaint_id: 1, title: 'A', status_name: 'Pending Approval' },
        { complaint_id: 2, title: 'B', status_name: 'Pending Approval' },
      ]]);

    const req = { query: {}, user: { role_id: 3, staff_id: 99 } };
    const res = mockRes();
    const next = jest.fn();

    await ctrl.listPending(req, res, next);

    // Confirm the WHERE clause filters on status_id = 3
    expect(db.execute.mock.calls[0][0]).toMatch(/c\.status_id\s*=\s*3/);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ complaint_id: 1 })]),
        pagination: expect.objectContaining({ total: 2 }),
      })
    );
  });
});

describe('approvalsController.approve — FR-11', () => {
  test('returns 404 when complaint does not exist', async () => {
    const conn = mockConn();
    db.getConnection.mockResolvedValue(conn);
    conn.execute.mockResolvedValueOnce([[]]); // not found

    const req = { params: { id: '99' }, body: {}, user: { staff_id: 1 } };
    const next = jest.fn();
    await ctrl.approve(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('rejects approval when complaint is not in Pending Approval status', async () => {
    const conn = mockConn();
    db.getConnection.mockResolvedValue(conn);
    conn.execute.mockResolvedValueOnce([[{ complaint_id: 1, status_id: 1 }]]); // Submitted

    const req = { params: { id: '1' }, body: {}, user: { staff_id: 1 } };
    const next = jest.fn();
    await ctrl.approve(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.code).toBe('INVALID_TRANSITION');
  });

  test('approves successfully and writes APPROVALS + TRACKING + UPDATE in a transaction', async () => {
    const conn = mockConn();
    db.getConnection.mockResolvedValue(conn);
    conn.execute
      .mockResolvedValueOnce([[{ complaint_id: 5, status_id: 3 }]]) // pending
      .mockResolvedValueOnce([{}])  // INSERT APPROVALS
      .mockResolvedValueOnce([{}]); // UPDATE COMPLAINTS

    const req = { params: { id: '5' }, body: { comment: 'OK' }, user: { staff_id: 99 } };
    const res = mockRes();
    await ctrl.approve(req, res, jest.fn());

    expect(recordTransition).toHaveBeenCalledWith(
      conn,
      expect.objectContaining({ toStatusId: 4, fromStatusId: 3 })
    );
    expect(conn.commit).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approved', to_status: 'Approved' })
    );
  });
});

describe('approvalsController.reject — FR-13', () => {
  test('blocks rejection without a comment', async () => {
    const conn = mockConn();
    db.getConnection.mockResolvedValue(conn);

    const req = { params: { id: '5' }, body: { comment: '' }, user: { staff_id: 99 } };
    const next = jest.fn();
    await ctrl.reject(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('rejects from Under Review with a comment', async () => {
    const conn = mockConn();
    db.getConnection.mockResolvedValue(conn);
    conn.execute
      .mockResolvedValueOnce([[{ complaint_id: 5, status_id: 2 }]]) // Under Review
      .mockResolvedValueOnce([{}])  // INSERT APPROVALS
      .mockResolvedValueOnce([{}]); // UPDATE COMPLAINTS

    const req = { params: { id: '5' }, body: { comment: 'Insufficient evidence' }, user: { staff_id: 99 } };
    const res = mockRes();
    await ctrl.reject(req, res, jest.fn());

    expect(recordTransition).toHaveBeenCalledWith(
      conn,
      expect.objectContaining({ toStatusId: 5, fromStatusId: 2 })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'rejected', to_status: 'Rejected' })
    );
  });
});
