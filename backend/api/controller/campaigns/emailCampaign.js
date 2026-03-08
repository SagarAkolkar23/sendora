import pool from "../../../config/db.js";
import { campaignQueue } from "../../../queues/emailQueue.js";
import { extractCsvHeaders } from "../../helper/extractCSV.js";

export async function uploadRecipientsCsv(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ ok: false, message: "CSV file is required" });
    }

    const { originalname, filename, path: filePath } = req.file;
    const fileUrl = `/uploads/csv/${filename}`;

    const columns = await extractCsvHeaders(filePath);

    if (!columns.length) {
      return res.status(400).json({
        ok: false,
        message: "File appears to be empty or invalid",
      });
    }

    const hasEmail = columns.some((col) => col.toLowerCase() === "email");

    if (!hasEmail) {
      return res.status(400).json({
        ok: false,
        message: "CSV must contain an 'email' column",
        detectedColumns: columns,
      });
    }

    const result = await pool.query(
      `
      INSERT INTO uploads (
        user_id,
        original_filename,
        stored_filename,
        file_path,
        file_url,
        columns,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'QUEUED')
      RETURNING *
      `,
      [
        userId,
        originalname,
        filename,
        filePath,
        fileUrl,
        JSON.stringify(columns),
      ],
    );

    return res.status(201).json({
      ok: true,
      message: "CSV validated and uploaded successfully",
      upload: result.rows[0],
      columns,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      message: "Upload failed",
      error: err.message,
    });
  }
}

export async function getUploadColumns(req, res) {
  try {
    const userId = req.user?.userId;
    const { uploadId } = req.params;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized",
      });
    }

    if (!uploadId) {
      return res.status(400).json({
        ok: false,
        message: "uploadId is required",
      });
    }

    const result = await pool.query(
      `
      SELECT id, columns
      FROM uploads
      WHERE id = $1 AND user_id = $2
      `,
      [uploadId, userId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Upload not found",
      });
    }

    const upload = result.rows[0];

    return res.status(200).json({
      ok: true,
      uploadId: upload.id,
      columns: upload.columns,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch columns",
      error: err.message,
    });
  }
}

export async function createCampaign(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const { uploadId, title, subject, bodyHtml } = req.body;

    if (!title || title.length < 3) {
      return res
        .status(400)
        .json({ ok: false, message: "Title must be at least 3 characters" });
    }

    if (!subject || subject.length < 3) {
      return res
        .status(400)
        .json({ ok: false, message: "Subject must be at least 3 characters" });
    }

    if (!bodyHtml || bodyHtml.length < 10) {
      return res
        .status(400)
        .json({ ok: false, message: "Body must be at least 10 characters" });
    }

    if (!uploadId) {
      return res.status(402).json({ ok: false, message: "upload failed" });
    }

    const uploadCheck = await pool.query(
      `SELECT id FROM uploads WHERE id = $1 AND user_id = $2`,
      [uploadId, userId],
    );

    if (uploadCheck.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Upload not found or doesn't belong to you",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO campaigns (user_id, upload_id, title, subject, body_html, status)
      VALUES ($1, $2, $3, $4, $5, 'DRAFT')
      RETURNING id, user_id, upload_id, title, subject, body_html, status, created_at
      `,
      [userId, uploadId ?? null, title, subject, bodyHtml],
    );

    return res.status(201).json({
      ok: true,
      message: "Campaign created successfully",
      campaign: result.rows[0],
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export async function createCampaignJob(req, res) {
  const { campaignId } = req.body;
  const userId = req.user.userId;

  await campaignQueue.add("PROCESS_CAMPAIGN", {
    campaignId,
    userId,
  });

  return res.json({
    ok: true,
    message: "Campaign processing started",
  });
}

export async function getUploadColumns(req, res) {
  try {
    const userId = req.user?.userId;
    const { uploadId } = req.params;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized",
      });
    }

    if (!uploadId) {
      return res.status(400).json({
        ok: false,
        message: "uploadId is required",
      });
    }

    const result = await pool.query(
      `
      SELECT id, columns
      FROM uploads
      WHERE id = $1 AND user_id = $2
      `,
      [uploadId, userId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Upload not found",
      });
    }

    const upload = result.rows[0];

    return res.status(200).json({
      ok: true,
      uploadId: upload.id,
      columns: upload.columns,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch columns",
      error: err.message,
    });
  }
}