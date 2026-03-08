import fs from "fs";
import csv from "csv-parser";
import pool from "../config/db.js";
import { emailQueue } from "../queues/emailQueue.js";

function renderTemplate(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, String(value ?? ""));
  }
  return result;
}

export async function campaignHandler(job) {
  const { campaignId, userId } = job.data;

  const campaignRes = await pool.query(
    `SELECT id, upload_id, body_html
     FROM campaigns
     WHERE id=$1 AND user_id=$2`,
    [campaignId, userId],
  );

  const campaign = campaignRes.rows[0];

  const uploadRes = await pool.query(
    `SELECT file_path, columns
     FROM uploads
     WHERE id=$1 AND user_id=$2`,
    [campaign.upload_id, userId],
  );

  const { file_path, columns } = uploadRes.rows[0];

  const normalizedColumns = columns.map((c) => c.trim());

  const stream = fs.createReadStream(file_path).pipe(csv());

  for await (const row of stream) {
    const variables = {};

    for (const col of normalizedColumns) {
      variables[col] =
        row[col] ?? row[col.toLowerCase()] ?? row[col.toUpperCase()] ?? "";
    }

    const email = String(variables.email || "").trim();
    if (!email) continue;

    await emailQueue.add("SEND_EMAIL", {
      campaignId,
      email,
      variables,
    });
  }
}

