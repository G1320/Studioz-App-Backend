import bizSdk from 'facebook-nodejs-business-sdk';
import {
  META_APP_ID,
  META_APP_SECRET,
  META_ACCESS_TOKEN,
  META_AD_ACCOUNT_ID,
  META_API_VERSION
} from '../config/index.js';

const { FacebookAdsApi, AdAccount, Campaign, AdSet, Ad, AdCreative, CustomAudience } = bizSdk;

// ---------------------------------------------------------------------------
// SDK Initialisation
// ---------------------------------------------------------------------------

let api: InstanceType<typeof FacebookAdsApi> | null = null;

function getApi(): InstanceType<typeof FacebookAdsApi> {
  if (!api) {
    if (!META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN is not configured');
    api = FacebookAdsApi.init(META_ACCESS_TOKEN);
    api.setDebug(process.env.NODE_ENV !== 'production');
  }
  return api;
}

function getAdAccount(): InstanceType<typeof AdAccount> {
  getApi();
  if (!META_AD_ACCOUNT_ID) throw new Error('META_AD_ACCOUNT_ID is not configured');
  return new AdAccount(META_AD_ACCOUNT_ID);
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export interface CreateCampaignParams {
  name: string;
  objective: string;
  status?: string;
  special_ad_categories?: string[];
  daily_budget?: number;
  lifetime_budget?: number;
  bid_strategy?: string;
}

export const getCampaigns = async (params: Record<string, unknown> = {}) => {
  const account = getAdAccount();
  const fields = [
    'id', 'name', 'objective', 'status', 'effective_status',
    'daily_budget', 'lifetime_budget', 'budget_remaining',
    'start_time', 'stop_time', 'created_time', 'updated_time',
    'bid_strategy', 'special_ad_categories', 'buying_type'
  ];
  const campaigns = await account.getCampaigns(fields, {
    limit: params.limit || 50,
    ...params
  });
  return campaigns.map((c: any) => c._data);
};

export const getCampaignById = async (campaignId: string) => {
  getApi();
  const campaign = new Campaign(campaignId);
  const fields = [
    'id', 'name', 'objective', 'status', 'effective_status',
    'daily_budget', 'lifetime_budget', 'budget_remaining',
    'start_time', 'stop_time', 'created_time', 'updated_time',
    'bid_strategy', 'special_ad_categories', 'buying_type'
  ];
  const data = await campaign.get(fields);
  return data._data;
};

export const createCampaign = async (params: CreateCampaignParams) => {
  const account = getAdAccount();
  const campaign = await account.createCampaign([], {
    name: params.name,
    objective: params.objective,
    status: params.status || 'PAUSED',
    special_ad_categories: params.special_ad_categories || ['NONE'],
    ...(params.daily_budget && { daily_budget: params.daily_budget }),
    ...(params.lifetime_budget && { lifetime_budget: params.lifetime_budget }),
    ...(params.bid_strategy && { bid_strategy: params.bid_strategy })
  });
  return campaign._data;
};

export const updateCampaign = async (campaignId: string, params: Record<string, unknown>) => {
  getApi();
  const campaign = new Campaign(campaignId);
  const result = await campaign.update([], params);
  return result._data;
};

export const updateCampaignStatus = async (campaignId: string, status: string) => {
  return updateCampaign(campaignId, { status });
};

export const deleteCampaign = async (campaignId: string) => {
  getApi();
  const campaign = new Campaign(campaignId);
  await campaign.delete([]);
  return { success: true };
};

// ---------------------------------------------------------------------------
// Ad Sets
// ---------------------------------------------------------------------------

export interface CreateAdSetParams {
  name: string;
  campaign_id: string;
  daily_budget?: number;
  lifetime_budget?: number;
  bid_amount?: number;
  billing_event: string;
  optimization_goal: string;
  targeting: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
  status?: string;
  promoted_object?: Record<string, unknown>;
}

export const getAdSets = async (campaignId: string, params: Record<string, unknown> = {}) => {
  getApi();
  const campaign = new Campaign(campaignId);
  const fields = [
    'id', 'name', 'campaign_id', 'status', 'effective_status',
    'daily_budget', 'lifetime_budget', 'bid_amount', 'bid_strategy',
    'billing_event', 'optimization_goal', 'targeting',
    'start_time', 'end_time', 'created_time', 'updated_time'
  ];
  const adSets = await campaign.getAdSets(fields, {
    limit: params.limit || 50,
    ...params
  });
  return adSets.map((a: any) => a._data);
};

export const getAdSetById = async (adSetId: string) => {
  getApi();
  const adSet = new AdSet(adSetId);
  const fields = [
    'id', 'name', 'campaign_id', 'status', 'effective_status',
    'daily_budget', 'lifetime_budget', 'bid_amount', 'bid_strategy',
    'billing_event', 'optimization_goal', 'targeting',
    'start_time', 'end_time', 'created_time', 'updated_time'
  ];
  const data = await adSet.get(fields);
  return data._data;
};

export const createAdSet = async (params: CreateAdSetParams) => {
  const account = getAdAccount();
  const adSet = await account.createAdSet([], {
    name: params.name,
    campaign_id: params.campaign_id,
    billing_event: params.billing_event,
    optimization_goal: params.optimization_goal,
    targeting: params.targeting,
    status: params.status || 'PAUSED',
    ...(params.daily_budget && { daily_budget: params.daily_budget }),
    ...(params.lifetime_budget && { lifetime_budget: params.lifetime_budget }),
    ...(params.bid_amount && { bid_amount: params.bid_amount }),
    ...(params.start_time && { start_time: params.start_time }),
    ...(params.end_time && { end_time: params.end_time }),
    ...(params.promoted_object && { promoted_object: params.promoted_object })
  });
  return adSet._data;
};

export const updateAdSet = async (adSetId: string, params: Record<string, unknown>) => {
  getApi();
  const adSet = new AdSet(adSetId);
  const result = await adSet.update([], params);
  return result._data;
};

export const updateAdSetStatus = async (adSetId: string, status: string) => {
  return updateAdSet(adSetId, { status });
};

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------

export interface CreateAdParams {
  name: string;
  adset_id: string;
  creative: { creative_id: string } | Record<string, unknown>;
  status?: string;
  tracking_specs?: Record<string, unknown>[];
}

export const getAds = async (adSetId: string, params: Record<string, unknown> = {}) => {
  getApi();
  const adSet = new AdSet(adSetId);
  const fields = [
    'id', 'name', 'adset_id', 'campaign_id', 'status', 'effective_status',
    'creative', 'created_time', 'updated_time', 'tracking_specs'
  ];
  const ads = await adSet.getAds(fields, {
    limit: params.limit || 50,
    ...params
  });
  return ads.map((a: any) => a._data);
};

export const getAdById = async (adId: string) => {
  getApi();
  const ad = new Ad(adId);
  const fields = [
    'id', 'name', 'adset_id', 'campaign_id', 'status', 'effective_status',
    'creative', 'created_time', 'updated_time', 'tracking_specs'
  ];
  const data = await ad.get(fields);
  return data._data;
};

export const createAd = async (params: CreateAdParams) => {
  const account = getAdAccount();
  const ad = await account.createAd([], {
    name: params.name,
    adset_id: params.adset_id,
    creative: params.creative,
    status: params.status || 'PAUSED',
    ...(params.tracking_specs && { tracking_specs: params.tracking_specs })
  });
  return ad._data;
};

export const updateAd = async (adId: string, params: Record<string, unknown>) => {
  getApi();
  const ad = new Ad(adId);
  const result = await ad.update([], params);
  return result._data;
};

export const updateAdStatus = async (adId: string, status: string) => {
  return updateAd(adId, { status });
};

// ---------------------------------------------------------------------------
// Creatives & Media
// ---------------------------------------------------------------------------

export const createCreative = async (params: Record<string, unknown>) => {
  const account = getAdAccount();
  const creative = await account.createAdCreative([], params);
  return creative._data;
};

export const uploadImage = async (filePath: string, fileName: string) => {
  const account = getAdAccount();
  const image = await account.createAdImage([], {
    filename: filePath,
    name: fileName
  });
  return image._data;
};

export const uploadVideo = async (filePath: string, title: string) => {
  const account = getAdAccount();
  const video = await account.createAdVideo([], {
    source: filePath,
    title
  });
  return video._data;
};

export const getAdImages = async (params: Record<string, unknown> = {}) => {
  const account = getAdAccount();
  const images = await account.getAdImages(
    ['id', 'name', 'hash', 'url', 'url_128', 'width', 'height', 'created_time'],
    { limit: 50, ...params }
  );
  return images.map((i: any) => i._data);
};

export const getAdVideos = async (params: Record<string, unknown> = {}) => {
  const account = getAdAccount();
  const videos = await account.getAdVideos(
    ['id', 'title', 'source', 'picture', 'length', 'created_time', 'updated_time'],
    { limit: 50, ...params }
  );
  return videos.map((v: any) => v._data);
};

// ---------------------------------------------------------------------------
// Audiences
// ---------------------------------------------------------------------------

export interface CreateAudienceParams {
  name: string;
  subtype: string;
  description?: string;
  customer_file_source?: string;
  rule?: Record<string, unknown>;
  lookalike_spec?: Record<string, unknown>;
  origin_audience_id?: string;
}

export const getAudiences = async (params: Record<string, unknown> = {}) => {
  const account = getAdAccount();
  const fields = [
    'id', 'name', 'subtype', 'description', 'approximate_count',
    'delivery_status', 'operation_status', 'time_created', 'time_updated',
    'lookalike_spec', 'rule'
  ];
  const audiences = await account.getCustomAudiences(fields, {
    limit: 50,
    ...params
  });
  return audiences.map((a: any) => a._data);
};

export const getAudienceById = async (audienceId: string) => {
  getApi();
  const audience = new CustomAudience(audienceId);
  const fields = [
    'id', 'name', 'subtype', 'description', 'approximate_count',
    'delivery_status', 'operation_status', 'time_created', 'time_updated',
    'lookalike_spec', 'rule'
  ];
  const data = await audience.get(fields);
  return data._data;
};

export const createAudience = async (params: CreateAudienceParams) => {
  const account = getAdAccount();
  const audience = await account.createCustomAudience([], {
    name: params.name,
    subtype: params.subtype,
    ...(params.description && { description: params.description }),
    ...(params.customer_file_source && { customer_file_source: params.customer_file_source }),
    ...(params.rule && { rule: params.rule }),
    ...(params.lookalike_spec && { lookalike_spec: params.lookalike_spec }),
    ...(params.origin_audience_id && { origin_audience_id: params.origin_audience_id })
  });
  return audience._data;
};

export const updateAudience = async (audienceId: string, params: Record<string, unknown>) => {
  getApi();
  const audience = new CustomAudience(audienceId);
  const result = await audience.update([], params);
  return result._data;
};

export const deleteAudience = async (audienceId: string) => {
  getApi();
  const audience = new CustomAudience(audienceId);
  await audience.delete([]);
  return { success: true };
};

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export interface InsightsParams {
  time_range?: { since: string; until: string };
  date_preset?: string;
  breakdowns?: string[];
  fields?: string[];
  level?: string;
  limit?: number;
}

const DEFAULT_INSIGHT_FIELDS = [
  'campaign_name', 'campaign_id', 'adset_name', 'adset_id', 'ad_name', 'ad_id',
  'impressions', 'reach', 'clicks', 'cpc', 'cpm', 'ctr', 'spend',
  'actions', 'cost_per_action_type', 'conversions', 'conversion_values',
  'frequency', 'date_start', 'date_stop'
];

export const getAccountInsights = async (params: InsightsParams = {}) => {
  const account = getAdAccount();
  const fields = params.fields || DEFAULT_INSIGHT_FIELDS;
  const requestParams: Record<string, unknown> = {
    level: params.level || 'account',
    ...(params.time_range && { time_range: params.time_range }),
    ...(params.date_preset && { date_preset: params.date_preset }),
    ...(params.breakdowns && { breakdowns: params.breakdowns }),
    limit: params.limit || 100
  };
  const insights = await account.getInsights(fields, requestParams);
  return insights.map((i: any) => i._data);
};

export const getCampaignInsights = async (campaignId: string, params: InsightsParams = {}) => {
  getApi();
  const campaign = new Campaign(campaignId);
  const fields = params.fields || DEFAULT_INSIGHT_FIELDS;
  const requestParams: Record<string, unknown> = {
    level: params.level || 'campaign',
    ...(params.time_range && { time_range: params.time_range }),
    ...(params.date_preset && { date_preset: params.date_preset }),
    ...(params.breakdowns && { breakdowns: params.breakdowns }),
    limit: params.limit || 100
  };
  const insights = await campaign.getInsights(fields, requestParams);
  return insights.map((i: any) => i._data);
};

export const getAdSetInsights = async (adSetId: string, params: InsightsParams = {}) => {
  getApi();
  const adSet = new AdSet(adSetId);
  const fields = params.fields || DEFAULT_INSIGHT_FIELDS;
  const requestParams: Record<string, unknown> = {
    ...(params.time_range && { time_range: params.time_range }),
    ...(params.date_preset && { date_preset: params.date_preset }),
    ...(params.breakdowns && { breakdowns: params.breakdowns }),
    limit: params.limit || 100
  };
  const insights = await adSet.getInsights(fields, requestParams);
  return insights.map((i: any) => i._data);
};

export const getAdInsights = async (adId: string, params: InsightsParams = {}) => {
  getApi();
  const ad = new Ad(adId);
  const fields = params.fields || DEFAULT_INSIGHT_FIELDS;
  const requestParams: Record<string, unknown> = {
    ...(params.time_range && { time_range: params.time_range }),
    ...(params.date_preset && { date_preset: params.date_preset }),
    ...(params.breakdowns && { breakdowns: params.breakdowns }),
    limit: params.limit || 100
  };
  const insights = await ad.getInsights(fields, requestParams);
  return insights.map((i: any) => i._data);
};

export default {
  // Campaigns
  getCampaigns, getCampaignById, createCampaign, updateCampaign, updateCampaignStatus, deleteCampaign,
  // Ad Sets
  getAdSets, getAdSetById, createAdSet, updateAdSet, updateAdSetStatus,
  // Ads
  getAds, getAdById, createAd, updateAd, updateAdStatus,
  // Creatives & Media
  createCreative, uploadImage, uploadVideo, getAdImages, getAdVideos,
  // Audiences
  getAudiences, getAudienceById, createAudience, updateAudience, deleteAudience,
  // Insights
  getAccountInsights, getCampaignInsights, getAdSetInsights, getAdInsights
};
