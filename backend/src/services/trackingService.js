/**
 * Tracking service â€” append-only audit log.
 * Implements FR-19 and addresses Gap 2 (no audit trail in legacy system).
 *
 * Every status change inserts one row in TRACKING inside the same DB
 * transaction as the COMPLAINTS.status_id UPDATE (NFR-3). Rows are never
 * updated or deleted.
 *
 * Column names match schema.sql exactly:
 *   TRACKING.complaint_id, changed_by, from_status_id, to_status_id, notes, changed_at
 */

/**
 * Insert a tracking row inside an existing transaction connection.
 * @param {import('mysql2/promise').PoolConnection} conn  â€” active transaction connection
 * @param {object} params
 * @param {number} params.complaintId
 * @param {number} params.changedBy      â€” staff_id of the person making the change
 * @param {number|null} params.fromStatusId â€” NULL on initial "Submitted" entry
 * @param {number} params.toStatusId
 * @param {string|null} params.notes     â€” optional comment
 */
async function recordTransition(conn, { complaintId, changedBy, fromStatusId, toStatusId, notes }) {
    await conn.execute(
      `INSERT INTO TRACKING (complaint_id, changed_by, from_status_id, to_status_id, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [complaintId, changedBy, fromStatusId || null, toStatusId, notes || null]
    );
  }
  
  module.exports = { recordTransition };
  