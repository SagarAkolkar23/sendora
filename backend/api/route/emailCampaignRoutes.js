import { Router } from "express";
import { createCampaign, uploadRecipientsCsv } from "../controller/campaigns/emailCampaign";
import { authMiddleware } from "../middleware/authMiddleware";
import { uploadCsv } from "../middleware/uploadCsv";

const router = Router();

router.post(
  "/csv",
  authMiddleware,
  uploadCsv.single("file"),
  uploadRecipientsCsv,
);

router.post("/campaign", authMiddleware, createCampaign);

export default router;
