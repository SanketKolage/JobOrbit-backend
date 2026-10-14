const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { validateUploadFile } = require("../utils/security");

const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeBaseName = path.basename(file.originalname || "resume").replace(/[^a-zA-Z0-9._-]/g, "-");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(safeBaseName).toLowerCase() || ".pdf";
    cb(null, `resume-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  try {
    validateUploadFile(file);
    cb(null, true);
  } catch (error) {
    cb(new Error(error.message), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = upload;
