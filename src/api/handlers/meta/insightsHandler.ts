import { Request } from 'express';
import handleRequest from '../../../utils/requestHandler.js';
import ExpressError from '../../../utils/expressError.js';
import * as metaService from '../../../services/metaService.js';
import { getCached, setCached, type CacheTier } from '../../../services/metaInsightsCacheService.js';

function parseInsightsParams(req: Request): metaService.InsightsParams {
  const { since, until, date_preset, breakdowns, level } = req.query;
  const params: metaService.InsightsParams = {};
  if (since && until) {
    params.time_range = { since: since as string, until: until as string };
  }
  if (date_preset) params.date_preset = date_preset as string;
  if (breakdowns) params.breakdowns = (breakdowns as string).split(',');
  if (level) params.level = level as string;
  return params;
}

function getCacheTier(params: metaService.InsightsParams): CacheTier {
  if (params.breakdowns?.length) return 'BREAKDOWN';
  if (params.date_preset === 'today' || params.date_preset === 'yesterday') return 'REALTIME';
  return 'HISTORICAL';
}

const getAccountInsights = handleRequest(async (req: Request) => {
  const params = parseInsightsParams(req);
  const cacheKey = 'account_insights';
  const cached = getCached(cacheKey, params as Record<string, unknown>);
  if (cached) return cached;

  const data = await metaService.getAccountInsights(params);
  setCached(cacheKey, params as Record<string, unknown>, data, getCacheTier(params));
  return data;
});

const getCampaignInsights = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Campaign ID is required', 400);
  const params = parseInsightsParams(req);
  const cacheKey = `campaign_insights_${id}`;
  const cached = getCached(cacheKey, params as Record<string, unknown>);
  if (cached) return cached;

  const data = await metaService.getCampaignInsights(id, params);
  setCached(cacheKey, params as Record<string, unknown>, data, getCacheTier(params));
  return data;
});

const getAdSetInsights = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Ad Set ID is required', 400);
  const params = parseInsightsParams(req);
  const cacheKey = `adset_insights_${id}`;
  const cached = getCached(cacheKey, params as Record<string, unknown>);
  if (cached) return cached;

  const data = await metaService.getAdSetInsights(id, params);
  setCached(cacheKey, params as Record<string, unknown>, data, getCacheTier(params));
  return data;
});

const getAdInsights = handleRequest(async (req: Request) => {
  const { id } = req.params;
  if (!id) throw new ExpressError('Ad ID is required', 400);
  const params = parseInsightsParams(req);
  const cacheKey = `ad_insights_${id}`;
  const cached = getCached(cacheKey, params as Record<string, unknown>);
  if (cached) return cached;

  const data = await metaService.getAdInsights(id, params);
  setCached(cacheKey, params as Record<string, unknown>, data, getCacheTier(params));
  return data;
});

export default {
  getAccountInsights,
  getCampaignInsights,
  getAdSetInsights,
  getAdInsights
};
