/**
 * Multer configuration for file uploads.
 * Implements FR-7. Addresses Gap 3 (digital-first attachments).
 *
 * - Files saved to /uploads/<uuid>.<ext> (UUID filenames prevent collisions)
 * - Max size: 10 MB per api-spec.md §3
 * - Allowed MIME types: PDF, JPEG, PNG, DOCX
 */

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.resolve(env.uploads.dir);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'UNSUPPORTED_FILE_TYPE',
      'Only PDF, JPEG, PNG, and DOCX files are allowed.'), false);
  }
};

const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.uploads.maxSizeMb * 1024 * 1024 },
});

module.exports = uploadMiddleware;
