/**
 * Attachments controller.
 * Implements FR-7 (file upload), FR-8 (is_scanned auto-flip).
 * Addresses Gap 3 (legacy default was "Transaction Not Scanned").
 *
 * Files are stored on disk under /uploads/<uuid>.<ext> per api-spec.md §3.
 * Column names match schema.sql ATTACHMENTS table exactly.
 */

const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const ApiError = require('../utils/apiError');

/**
 * POST /complaints/:id/attachments — Upload a file.
 * Multer middleware runs before this handler and places the file in req.file.
 * Accepts: PDF, JPEG, PNG, DOCX. Max 10 MB.
 *
 * After inserting into ATTACHMENTS, flips COMPLAINTS.is_scanned to 1 (FR-8).
 */
async function upload(req, res, next) {
  try {
    const complaintId = req.params.id;

    // Verify complaint exists
    const [existing] = await db.execute(
      'SELECT complaint_id FROM COMPLAINTS WHERE complaint_id = ?',
      [complaintId]
    );
    if (existing.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return next(new ApiError(404, 'NOT_FOUND', 'Complaint not found.'));
    }

    if (!req.file) {
      return next(new ApiError(400, 'VALIDATION_FAILED', 'No file was uploaded. Use field name "file".'));
    }

    const fileSizeKb = Math.round(req.file.size / 1024);

    const [result] = await db.execute(
      `INSERT INTO ATTACHMENTS (complaint_id, uploaded_by, file_name, file_path, mime_type, file_size_kb)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        complaintId,
        req.user.staff_id,
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        fileSizeKb,
      ]
    );

    // FR-8: flip is_scanned to 1
    await db.execute(
      'UPDATE COMPLAINTS SET is_scanned = 1 WHERE complaint_id = ? AND is_scanned = 0',
      [complaintId]
    );

    return res.status(201).json({
      attachment_id: result.insertId,
      complaint_id: Number(complaintId),
      file_name: req.file.originalname,
      mime_type: req.file.mimetype,
      file_size_kb: fileSizeKb,
      uploaded_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /complaints/:id/attachments — List all attachments for a complaint.
 */
async function listByComplaint(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT a.attachment_id, a.file_name, a.mime_type, a.file_size_kb,
              a.uploaded_at, s.full_name AS uploaded_by_name
         FROM ATTACHMENTS a
         JOIN STAFF s ON s.staff_id = a.uploaded_by
        WHERE a.complaint_id = ?
        ORDER BY a.uploaded_at DESC`,
      [id]
    );
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /attachments/:id/download — Download a file.
 * Streams the file with its original file_name in Content-Disposition.
 */
async function download(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      'SELECT file_name, file_path, mime_type FROM ATTACHMENTS WHERE attachment_id = ?',
      [id]
    );
    if (rows.length === 0) {
      return next(new ApiError(404, 'NOT_FOUND', 'Attachment not found.'));
    }

    const attachment = rows[0];
    const uploadsDir = require('../config/env').uploads.dir;
    const fullPath = path.resolve(uploadsDir, attachment.file_path);

    if (!fs.existsSync(fullPath)) {
      return next(new ApiError(404, 'NOT_FOUND', 'File not found on server.'));
    }

    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.file_name}"`);
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /attachments/:id — Remove an attachment (Admin only).
 */
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      'SELECT attachment_id, file_path, complaint_id FROM ATTACHMENTS WHERE attachment_id = ?',
      [id]
    );
    if (rows.length === 0) {
      return next(new ApiError(404, 'NOT_FOUND', 'Attachment not found.'));
    }

    const attachment = rows[0];
    await db.execute('DELETE FROM ATTACHMENTS WHERE attachment_id = ?', [id]);

    // Unlink file from disk (best-effort)
    const uploadsDir = require('../config/env').uploads.dir;
    const fullPath = path.resolve(uploadsDir, attachment.file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // If no attachments remain, flip is_scanned back to 0
    const [remaining] = await db.execute(
      'SELECT COUNT(*) AS cnt FROM ATTACHMENTS WHERE complaint_id = ?',
      [attachment.complaint_id]
    );
    if (remaining[0].cnt === 0) {
      await db.execute(
        'UPDATE COMPLAINTS SET is_scanned = 0 WHERE complaint_id = ?',
        [attachment.complaint_id]
      );
    }

    return res.json({ message: 'Attachment deleted.', attachment_id: Number(id) });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, listByComplaint, download, remove };
