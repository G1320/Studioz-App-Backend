import { Request } from 'express';
import handleRequest from '../../../utils/requestHandler.js';
import ExpressError from '../../../utils/expressError.js';
import * as metaService from '../../../services/metaService.js';

const getAudiences = handleRequest(async (req: Request) => {
  return metaService.getAudiences(req.query as Record<string, unknown>);
});

const getAudienceById = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Audience ID is required', 400);
  return metaService.getAudienceById(id);
});

const createAudience = handleRequest(async (req: Request) => {
  const { name, subtype } = req.body;
  if (!name) throw new ExpressError('Audience name is required', 400);
  if (!subtype) throw new ExpressError('Audience subtype is required', 400);
  return metaService.createAudience(req.body);
});

const updateAudience = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Audience ID is required', 400);
  return metaService.updateAudience(id, req.body);
});

const deleteAudience = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Audience ID is required', 400);
  await metaService.deleteAudience(id);
  return null;
});

export default {
  getAudiences,
  getAudienceById,
  createAudience,
  updateAudience,
  deleteAudience
};
