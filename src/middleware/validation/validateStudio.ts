import Joi from 'joi';
import handleJoiError from '../../utils/joiErrorHandler.js';
import { Request, Response, NextFunction } from 'express';
import {
  studioNameSchema,
  studioSubtitleSchema,
  studioDescriptionSchema
} from './translationSchemas.js';

const itemSchema = Joi.object({
  _id: Joi.string().optional(),
  idx: Joi.number().optional(),
  studioId: Joi.string().optional().label('Studio'),
  studioName: Joi.string().optional(),
  studioImgUrl: Joi.string().optional(),
  quantity: Joi.number().optional()
});

const portfolioItemSchema = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required(),
  artist: Joi.string().required().allow(''),
  type: Joi.string().valid('audio', 'video', 'album').required(),
  coverUrl: Joi.string().uri().optional().allow('', null),
  link: Joi.string().uri({ allowRelative: false }).required().allow(''),
  role: Joi.string().optional().allow('', null)
});

const socialLinksSchema = Joi.object({
  spotify: Joi.string().uri().optional().allow('', null),
  soundcloud: Joi.string().uri().optional().allow('', null),
  appleMusic: Joi.string().uri().optional().allow('', null),
  youtube: Joi.string().uri().optional().allow('', null),
  instagram: Joi.string().uri().optional().allow('', null),
  website: Joi.string().uri().optional().allow('', null)
}).optional();

const schema = Joi.object({
  _id: Joi.string().optional(),
  name: studioNameSchema,
  subtitle: studioSubtitleSchema,
  description: studioDescriptionSchema,
 
  studioAvailability: Joi.object({
    // Mongoose may attach a subdoc _id on GET; PUT echoes must not 400
    _id: Joi.string().hex().length(24).optional(),
    days: Joi.array().items(
      Joi.string().valid('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')
    ),
    times: Joi.array().items(
      Joi.object({
        _id: Joi.string().hex().length(24).optional(),
        start: Joi.string().required(),
        end: Joi.string().required()
      })
    )
  }).optional(),
  is24Hours: Joi.boolean().optional().allow(null),
  coverImage: Joi.string().required().allow('').label('Cover image'),
  galleryImages: Joi.array().required().items(Joi.string().allow('')).label('Gallery images'),
  coverAudioFile: Joi.string().optional().allow('', null).label('Cover audio'),
  galleryAudioFiles: Joi.array().items(Joi.string().allow('')).optional().label('Gallery audio files'),
  items: Joi.array().items(itemSchema).optional().label('Items array'),
  categories: Joi.array().items(Joi.string()),
  subCategories: Joi.array().items(Joi.string()).optional(),
  genres: Joi.array().items(Joi.string()).optional(),
  amenities: Joi.array().items(Joi.string()).optional(),
  equipment: Joi.array().items(
    Joi.object({
      category: Joi.string().required(),
      items: Joi.string().optional().allow('', null) // Raw text input
    })
  ).optional(),
  maxOccupancy: Joi.number().required().allow(null),
  size: Joi.number().optional().allow(null),
  isSmokingAllowed: Joi.boolean().optional().allow(null),
  city: Joi.string().optional().allow('', null),
  address: Joi.string().optional().allow('', null),
  phone: Joi.string().optional().allow('', null),
  website: Joi.string().uri().optional().allow('', null),
  socials: Joi.object({
    instagram: Joi.string().uri().optional().allow('', null),
    facebook: Joi.string().uri().optional().allow('', null)
  }).optional(),
  lat: Joi.number().optional().allow(null),
  lng: Joi.number().optional().allow(null),
  isWheelchairAccessible: Joi.boolean().optional().allow(null),
  isSelfService: Joi.boolean().optional().allow(null),
  parking: Joi.string().valid('private', 'street', 'paid', 'none').optional().allow(null).default('none'),
  arrivalInstructions: Joi.string().max(500).optional().allow('', null),
  cancellationPolicy: Joi.object({
    type: Joi.string().valid('flexible', 'moderate', 'strict').optional(),
    houseRules: Joi.object({
      en: Joi.string().max(1000).optional().allow('', null),
      he: Joi.string().max(1000).optional().allow('', null)
    }).optional()
  }).optional(),
  createdAt: Joi.date().default(Date.now).label('Creation Date'),
  isFeatured: Joi.boolean().optional(),
  paymentEnabled: Joi.boolean().optional().default(false),
  portfolio: Joi.array().items(portfolioItemSchema).optional(),
  socialLinks: socialLinksSchema
}).unknown(true);

const validateStudio = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: false });
  if (error) {
    handleJoiError(error);
  } else {
    next();
  }
};

export default validateStudio;
