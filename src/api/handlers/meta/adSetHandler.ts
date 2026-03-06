import { Request } from 'express';
import handleRequest from '../../../utils/requestHandler.js';
import ExpressError from '../../../utils/expressError.js';
import * as metaService from '../../../services/metaService.js';

const getAdSets = handleRequest(async (req: Request) => {
  const { campaignId } = req.params;
  if (!campaignId) throw new ExpressError('Campaign ID is required', 400);
  const { limit } = req.query;
  const params: Record<string, unknown> = {};
  if (limit) params.limit = Number(limit);
  return metaService.getAdSets(campaignId, params);
});

const getAdSetById = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Ad Set ID is required', 400);
  return metaService.getAdSetById(id);
});

const createAdSet = handleRequest(async (req: Request) => {
  const { name, campaign_id, billing_event, optimization_goal, targeting } = req.body;
  if (!name) throw new ExpressError('Ad Set name is required', 400);
  if (!campaign_id) throw new ExpressError('Campaign ID is required', 400);
  if (!billing_event) throw new ExpressError('Billing event is required', 400);
  if (!optimization_goal) throw new ExpressError('Optimization goal is required', 400);
  if (!targeting) throw new ExpressError('Targeting is required', 400);
  return metaService.createAdSet(req.body);
});

const updateAdSet = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Ad Set ID is required', 400);
  return metaService.updateAdSet(id, req.body);
});

const updateAdSetStatus = handleRequest(async (req: Request) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!id) throw new ExpressError('Ad Set ID is required', 400);
  if (!status) throw new ExpressError('Status is required', 400);
  return metaService.updateAdSetStatus(id, status);
});

export default {
  getAdSets,
  getAdSetById,
  createAdSet,
  updateAdSet,
  updateAdSetStatus
};
