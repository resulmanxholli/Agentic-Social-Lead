import { Router } from "express";
import { getLeadsController } from "../controllers/lead.controller.js";

const router = Router();

router.get("/leads", getLeadsController);

export default router;
