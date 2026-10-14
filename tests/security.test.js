const test = require('node:test');
const assert = require('node:assert/strict');

const { validateUploadFile, buildErrorResponse } = require('../utils/security');

test('validateUploadFile accepts valid PDF files', () => {
  assert.doesNotThrow(() => {
    validateUploadFile({ mimetype: 'application/pdf', originalname: 'resume.pdf', size: 150000 });
  });
});

test('validateUploadFile rejects unsupported types', () => {
  assert.throws(() => {
    validateUploadFile({ mimetype: 'application/javascript', originalname: 'resume.js', size: 150000 });
  }, /Only PDF, DOCX, DOC, and TXT files are allowed/i);
});

test('buildErrorResponse returns consistent JSON shape', () => {
  const response = buildErrorResponse(401, 'AUTH_REQUIRED', 'Authentication required');
  assert.deepEqual(response, {
    success: false,
    message: 'Authentication required',
    code: 'AUTH_REQUIRED',
  });
});
