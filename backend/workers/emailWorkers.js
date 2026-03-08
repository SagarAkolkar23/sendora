import { campaignHandler } from "../workerServices/campaignHandler";
import { createWorker } from "./worker";

createWorker("campaignQueue", campaignHandler);

createWorker("emailQueue", jobHandler);


