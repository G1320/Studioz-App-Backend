import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import handleJoiError from '../../utils/joiErrorHandler.js';

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 224;

const translationTitleSchema = Joi.object({
  en: Joi.string().trim().max(TITLE_MAX).optional().allow('', null),
  he: Joi.string().trim().max(TITLE_MAX).optional().allow('', null)
}).optional();

const translationDescriptionSchema = Joi.object({
  en: Joi.string().trim().max(DESCRIPTION_MAX).optional().allow('', null),
  he: Joi.string().trim().max(DESCRIPTION_MAX).optional().allow('', null)
}).optional();

const availabilitySchema = Joi.object({
  date: Joi.string().required(),
  times: Joi.array().items(Joi.string()).optional()
});

const durationSchema = Joi.object({
  value: Joi.number().positive().optional(),
  unit: Joi.string().valid('minutes', 'hours', 'days').optional()
}).optional();

const advanceBookingSchema = Joi.object({
  value: Joi.number().positive().optional(),
  unit: Joi.string().valid('minutes', 'hours', 'days').optional()
}).optional();

const cancellationPolicySchema = Joi.object({
  type: Joi.string().valid('flexible', 'moderate', 'strict').optional(),
  notes: Joi.object({
    en: Joi.string().max(500).optional().allow('', null),
    he: Joi.string().max(500).optional().allow('', null)
  }).optional()
}).optional();

const blockDiscountsSchema = Joi.object({
  eightHour: Joi.number().positive().optional().allow(null),
  twelveHour: Joi.number().positive().optional().allow(null)
}).optional();

const schema = Joi.object({
  name: translationTitleSchema,
  description: translationDescriptionSchema,
  studioName: translationTitleSchema,
  category: Joi.string().optional(),
  categories: Joi.array().items(Joi.string()).optional(),
  subCategory: Joi.string().optional(),
  subCategories: Joi.array().items(Joi.string()).optional(),
  genres: Joi.array().items(Joi.string()).optional(),
  price: Joi.number().optional(),
  pricePer: Joi.string().valid('hour', 'session', 'unit', 'song', 'project', 'day').optional(),
  blockDiscounts: blockDiscountsSchema,
  imgUrl: Joi.string().uri().optional(),
  idx: Joi.number().optional(),
  inStock: Joi.boolean().optional(),
  studioId: Joi.string().optional(),
  studioImgUrl: Joi.string().optional(),
  createdBy: Joi.string().optional(),
  address: Joi.string().optional(),
  city: Joi.string().optional(),
  lat: Joi.number().optional(),
  lng: Joi.number().optional(),
  sellerId: Joi.string().optional(),
  availability: Joi.array().items(availabilitySchema).optional(),
  instantBook: Joi.boolean().optional(),
  addOnIds: Joi.array().items(Joi.string()).optional(),
  
  // Booking Requirements
  minimumBookingDuration: durationSchema,
  minimumQuantity: Joi.number().positive().optional(),
  advanceBookingRequired: advanceBookingSchema,
  
  // Setup & Preparation
  preparationTime: durationSchema,
  
  // Policies
  cancellationPolicy: cancellationPolicySchema,
  
  // Remote Service
  remoteService: Joi.boolean().optional(),
  remoteAccessMethod: Joi.string().valid('zoom', 'teams', 'skype', 'custom', 'other').optional(),
  softwareRequirements: Joi.array().items(Joi.string()).optional(),
  
  // Quantity Management
  maxQuantityPerBooking: Joi.number().positive().optional()
}).unknown(true);

const validateItem = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = schema.validate(req.body ?? {});
  if (error) {
    handleJoiError(error);
  } else {
    next();
  }
};

export default validateItem;

