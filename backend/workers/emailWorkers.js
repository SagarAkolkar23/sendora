import { campaignHandler } from "../workerServices/campaignHandler.js";
import { emailHandler } from "../workerServices/emailHandler.js";
import { emailResultHandler } from "../workerServices/resultHandler.js";
import { createWorker } from "./worker.js";


/*
    USE concurrently to start all the workers with one command in package.json scripts
*/

createWorker("campaignQueue", campaignHandler);

createWorker("emailQueue", emailHandler, {
  concurrency: 5,
}); 

createWorker("emailResultQueue", emailResultHandler, {
  concurrency: 10,
});