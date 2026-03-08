import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads", "csv");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); 
    const safeBase = path
      .basename(file.originalname, ext)
      .replaceAll(" ", "_")
      .replace(/[^a-zA-Z0-9_-]/g, "");

    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}-${safeBase}${ext}`;
    cb(null, uniqueName);
  },
});

function csvFileFilter(req, file, cb) {
  const isCsv =
    file.mimetype === "text/csv" ||
    file.originalname.toLowerCase().endsWith(".csv");

  if (!isCsv) {
    return cb(new Error("Only CSV files are allowed"), false);
  }

  cb(null, true);
}

export const uploadCsv = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});