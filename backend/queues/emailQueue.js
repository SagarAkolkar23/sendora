import { Queue } from "bullmq";
import { connection } from "../config/redis.js";

export const campaignQueue = new Queue("campaignQueue", {
  connection,
});

export const emailQueue = new Queue("emailQueue", {
  connection,
});


export const emailResultQueue = new Queue("emailResultQueue", {
  connection,
});