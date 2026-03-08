import { Worker } from "bullmq";
import { connection } from "../config/redis.js";

export function createWorker(queueName, handler, options = {}) {
  const worker = new Worker(
    queueName,
    async (job) => {
      try {
        return await handler(job);
      } catch (err) {
        console.error(`Worker error in ${queueName}:`, err);
        throw err;
      }
    },
    {
      connection,
      ...options,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[${queueName}] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[${queueName}] Job ${job?.id} failed`, err);
  });

  worker.on("error", (err) => {
    console.error(`[${queueName}] Worker error`, err);
  });

  console.log(`Worker started for queue: ${queueName}`);

  return worker;
}
