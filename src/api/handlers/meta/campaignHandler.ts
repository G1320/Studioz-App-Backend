import { Request } from 'express';
import handleRequest from '../../../utils/requestHandler.js';
import ExpressError from '../../../utils/expressError.js';
import * as metaService from '../../../services/metaService.js';

const getCampaigns = handleRequest(async (req: Request) => {
  const { status, limit } = req.query;
  const params: Record<string, unknown> = {};
  if (status) params.effective_status = [status];
  if (limit) params.limit = Number(limit);
  return metaService.getCampaigns(params);
});

const getCampaignById = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Campaign ID is required', 400);
  return metaService.getCampaignById(id);
});

const createCampaign = handleRequest(async (req: Request) => {
  const { name, objective } = req.body;
  if (!name) throw new ExpressError('Campaign name is required', 400);
  if (!objective) throw new ExpressError('Campaign objective is required', 400);
  return metaService.createCampaign(req.body);
});

const updateCampaign = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Campaign ID is required', 400);
  return metaService.updateCampaign(id, req.body);
});

const updateCampaignStatus = handleRequest(async (req: Request) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!id) throw new ExpressError('Campaign ID is required', 400);
  if (!status) throw new ExpressError('Status is required', 400);
  return metaService.updateCampaignStatus(id, status);
});

const deleteCampaign = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Campaign ID is required', 400);
  await metaService.deleteCampaign(id);
  return null;
});

export default {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  updateCampaignStatus,
  deleteCampaign
};
