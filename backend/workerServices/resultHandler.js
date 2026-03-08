import dotenv from "dotenv";
import pool from "../config/db.js";

dotenv.config();

const BATCH_SIZE = Number(process.env.DBWRITER_BATCH_SIZE || 50);
const FLUSH_INTERVAL_MS = Number(process.env.DBWRITER_FLUSH_MS || 2000);

let buffer = [];
let flushing = false;

async function flushBuffer() {
  if (flushing) return;
  if (buffer.length === 0) return;

  flushing = true;

  const batch = buffer.splice(0, BATCH_SIZE);

  try {
    const sent = batch.filter((x) => x.status === "SENT");
    const failed = batch.filter((x) => x.status === "FAILED");

    if (sent.length > 0) {
      const ids = sent.map((x) => x.campaignEmailId);

      await pool.query(
        `
        UPDATE emailDash
        SET status = 'SENT',
            provider_message_id = COALESCE(provider_message_id, 'BATCHED'),
            sent_at = COALESCE(sent_at, NOW()),
            error_message = NULL,
            updated_at = NOW()
        WHERE id = ANY($1::int[])
        `,
        [ids],
      );
    }

    if (failed.length > 0) {
      const placeholders = failed
        .map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::text)`)
        .join(",");

      const params = [];

      for (const row of failed) {
        params.push(
          Number(row.campaignEmailId),
          String(row.errorMessage || "Unknown error"),
        );
      }

      await pool.query(
        `
        UPDATE emailDash e
        SET status = 'FAILED',
            error_message = v.error_message,
            failed_at = COALESCE(e.failed_at, NOW()),
            updated_at = NOW()
        FROM (VALUES ${placeholders}) AS v(id, error_message)
        WHERE e.id = v.id
        `,
        params,
      );
    }

    console.log(`✅ DB batch written: ${batch.length} results`);
  } catch (err) {
    console.error("❌ DB flush failed:", err.message);

    buffer.unshift(...batch);
  } finally {
    flushing = false;
  }
}

setInterval(flushBuffer, FLUSH_INTERVAL_MS);

export async function emailResultHandler(job) {
  const { campaignEmailId, status, errorMessage, providerMessageId } =
    job.data || {};

  if (!campaignEmailId || !status) {
    throw new Error("Missing campaignEmailId/status in result job data");
  }

  buffer.push({
    campaignEmailId: Number(campaignEmailId),
    status,
    errorMessage: errorMessage || null,
    providerMessageId: providerMessageId || null,
  });

  if (buffer.length >= BATCH_SIZE) {
    await flushBuffer();
  }

  return { ok: true };
}
