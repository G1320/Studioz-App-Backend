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
  times: Joi.array().items(Joi.string()).required()
});

const schema = Joi.object({
  name: translationTitleSchema,
  nameEn: Joi.string().trim().max(TITLE_MAX).optional().allow('', null),
  nameHe: Joi.string().trim().max(TITLE_MAX).optional().allow('', null),
  description: translationDescriptionSchema,
  descriptionEn: Joi.string().trim().max(DESCRIPTION_MAX).optional().allow('', null),
  descriptionHe: Joi.string().trim().max(DESCRIPTION_MAX).optional().allow('', null),
  studioName: translationTitleSchema,
  studioNameEn: Joi.string().trim().max(TITLE_MAX).optional().allow('', null),
  studioNameHe: Joi.string().trim().max(TITLE_MAX).optional().allow('', null),
  category: Joi.string().optional(),
  categories: Joi.array().items(Joi.string()).optional(),
  subCategory: Joi.string().optional(),
  subCategories: Joi.array().items(Joi.string()).optional(),
  genres: Joi.array().items(Joi.string()).optional(),
  price: Joi.number().optional(),
  pricePer: Joi.string().optional(),
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
  addOnIds: Joi.array().items(Joi.string()).optional()
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

