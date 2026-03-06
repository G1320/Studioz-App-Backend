import { Request } from 'express';
import handleRequest from '../../../utils/requestHandler.js';
import ExpressError from '../../../utils/expressError.js';
import * as metaService from '../../../services/metaService.js';

const getAds = handleRequest(async (req: Request) => {
  const { adSetId } = req.params;
  if (!adSetId) throw new ExpressError('Ad Set ID is required', 400);
  const { limit } = req.query;
  const params: Record<string, unknown> = {};
  if (limit) params.limit = Number(limit);
  return metaService.getAds(adSetId, params);
});

const getAdById = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Ad ID is required', 400);
  return metaService.getAdById(id);
});

const createAd = handleRequest(async (req: Request) => {
  const { name, adset_id, creative } = req.body;
  if (!name) throw new ExpressError('Ad name is required', 400);
  if (!adset_id) throw new ExpressError('Ad Set ID is required', 400);
  if (!creative) throw new ExpressError('Creative is required', 400);
  return metaService.createAd(req.body);
});

const updateAd = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Ad ID is required', 400);
  return metaService.updateAd(id, req.body);
});

const updateAdStatus = handleRequest(async (req: Request) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!id) throw new ExpressError('Ad ID is required', 400);
  if (!status) throw new ExpressError('Status is required', 400);
  return metaService.updateAdStatus(id, status);
});

export default {
  getAds,
  getAdById,
  createAd,
  updateAd,
  updateAdStatus
};
