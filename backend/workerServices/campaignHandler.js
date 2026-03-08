import fs from "fs";
import csv from "csv-parser";
import pool from "../config/db.js";
import { emailQueue } from "../queues/emailQueue.js";



export async function campaignHandler(job) {
  const { campaignId, userId } = job.data;

  // 1️⃣ Fetch campaign
  const campaignRes = await pool.query(
    `SELECT id, upload_id, subject, body_html
     FROM campaigns
     WHERE id=$1 AND user_id=$2`,
    [campaignId, userId],
  );

  if (!campaignRes.rowCount) {
    throw new Error("Campaign not found");
  }

  const campaign = campaignRes.rows[0];

  // 2️⃣ Fetch upload
  const uploadRes = await pool.query(
    `SELECT file_path, columns
     FROM uploads
     WHERE id=$1 AND user_id=$2`,
    [campaign.upload_id, userId],
  );

  if (!uploadRes.rowCount) {
    throw new Error("Upload not found");
  }

  const { file_path, columns } = uploadRes.rows[0];

  if (!fs.existsSync(file_path)) {
    throw new Error("CSV file missing on server");
  }

  const normalizedColumns = columns.map((c) => c.trim());

  const stream = fs.createReadStream(file_path).pipe(csv());

  let totalRows = 0;
  let queuedJobs = 0;

  for await (const row of stream) {
    totalRows++;

    const variables = {};

    for (const col of normalizedColumns) {
      variables[col] =
        row[col] ?? row[col.toLowerCase()] ?? row[col.toUpperCase()] ?? "";
    }

    const email = String(variables.email || "").trim();
    if (!email) continue;

    // Save email job record
    const insertRes = await pool.query(
      `
      INSERT INTO emailDash (
        campaign_id,
        user_id,
        email,
        status,
        variables
      )
      VALUES ($1, $2, $3, 'PENDING', $4)
      RETURNING id
      `,
      [campaign.id, userId, email, JSON.stringify(variables)],
    );

    const campaignEmailId = insertRes.rows[0].id;

    // 4️⃣ Enqueue job with only id
    await emailQueue.add(
      "SEND_EMAIL",
      { campaignEmailId },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    queuedJobs++;
  }

  await pool.query(
    `UPDATE campaigns SET status='QUEUED', updated_at=NOW() WHERE id=$1`,
    [campaign.id],
  );

  console.log(`Campaign ${campaignId} queued ${queuedJobs} emails`);

  return {
    totalRows,
    queuedJobs,
  };
}
