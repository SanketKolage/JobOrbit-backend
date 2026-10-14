const path = require('path');

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
]);
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt']);

function validateUploadFile(file = {}) {
  const mimetype = String(file.mimetype || '').trim().toLowerCase();
  const originalname = String(file.originalname || '');
  const extension = path.extname(originalname).toLowerCase();
  const size = Number(file.size || 0);

  if (!ALLOWED_MIME_TYPES.has(mimetype) || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error('Only PDF, DOCX, DOC, and TXT files are allowed');
  }

  if (size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 10MB limit');
  }

  return true;
}

function buildErrorResponse(statusCode, code, message) {
  return {
    success: false,
    message,
    code,
  };
}

module.exports = {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  validateUploadFile,
  buildErrorResponse,
};
