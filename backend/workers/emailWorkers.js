import { campaignHandler } from "../workerServices/campaignHandler";
import { emailHandler } from "../workerServices/emailHandler";
import { createWorker } from "./worker";


/*
    USE concurrently to start all the workers with one command in package.json scripts
*/

createWorker("campaignQueue", campaignHandler);

createWorker("emailQueue", emailHandler, {
  concurrency: 5,
}); 

