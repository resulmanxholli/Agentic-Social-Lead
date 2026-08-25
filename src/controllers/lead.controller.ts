import { type Request, type Response } from "express";
import { leadService } from "../services/lead.service.js";

export async function getLeadsController(req: Request, res: Response) {
  const leads = await leadService.getLeads();
  return res.status(200).json(leads);
}
