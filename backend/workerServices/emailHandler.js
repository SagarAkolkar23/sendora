import dotenv from "dotenv";
import pool from "../../../config/db.js";
import { emailResultQueue } from "../../../config/redis.js";
import { createTransport } from "../../worker/utils/mailer.js";

dotenv.config();

const transporter = createTransport();

function renderTemplate(bodyHtml, variables) {
  let result = bodyHtml;

  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, String(value ?? ""));
  }

  return result;
}

async function sendEmailProcessor(job) {
  const { campaignEmailId } = job.data;

  if (!campaignEmailId) {
    throw new Error("Missing campaignEmailId in job data");
  }

  // Load recipient + campaign info
  const res = await pool.query(
    `
    SELECT 
      ce.id,
      ce.email,
      ce.name,
      ce.user_id,
      ce.campaign_id,
      c.subject,
      c.body_html
    FROM emailDash ce
    JOIN campaigns c ON c.id = ce.campaign_id
    WHERE ce.id = $1
    `,
    [campaignEmailId],
  );

  if (res.rowCount === 0) {
    throw new Error("campaign_emails row not found");
  }

  const row = res.rows[0];

  const to = row.email;
  const name = row.name || "there";
  const subject = row.subject;

  const bodyHtml = renderTemplate(row.body_html, {
    name,
    email: to,
  });

  console.log(`📩 Sending email to ${to} (campaign: ${row.campaign_id})`);

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html: bodyHtml,
    });

    await emailResultQueue.add("EMAIL_RESULT", {
      campaignEmailId,
      status: "SENT",
      providerMessageId: info.messageId,
    });

    console.log(`✅ Email sent to ${to}, messageId: ${info.messageId}`);

    return { ok: true, to, messageId: info.messageId };
  } catch (err) {
    await emailResultQueue.add("EMAIL_RESULT", {
      campaignEmailId,
      status: "FAILED",
      errorMessage: err.message,
    });

    console.error(`❌ Failed sending to ${to}: ${err.message}`);

    throw err;
  }
}

/*
  This is the handler compatible with your generic worker
*/

export async function emailHandler(job) {
  console.log(`📨 Job received: ${job.name} | id=${job.id}`);

  switch (job.name) {
    case "SEND_EMAIL":
      return await sendEmailProcessor(job);

    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}
