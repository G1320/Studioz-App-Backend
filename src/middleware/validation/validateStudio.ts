import Joi from 'joi';
import handleJoiError from '../../utils/joiErrorHandler.js';
import { Request, Response, NextFunction } from 'express';

const itemSchema = Joi.object({
  _id: Joi.string().optional(),
  idx: Joi.number().optional(),
  studioId: Joi.string().optional().label('Studio'),
  studioName: Joi.string().optional(),
  studioImgUrl: Joi.string().optional(),
  quantity: Joi.number().optional()
});

const schema = Joi.object({
  _id: Joi.string().optional(),
  name: Joi.object({
    en: Joi.string().regex(/^[a-zA-Z0-9\s]*$/).min(3).max(20).required().label('English Name'),
    he: Joi.string().min(3).max(20).required().label('Hebrew Name')
  }).required(),
 
  subtitle: Joi.object({
    en: Joi.string().required().label('English Subtitle'), 
    he: Joi.string().required().label('Hebrew Subtitle')
  }).required(),
 
  description: Joi.object({
    en: Joi.string().required().label('English Description'),
    he: Joi.string().required().label('Hebrew Description')
  }).required(),
 
  studioAvailability: Joi.object({
    days: Joi.array().items(
      Joi.string().valid('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')
      ),
      times: Joi.array().items(
        Joi.object({
          _id: Joi.string().optional(),
          start: Joi.string().required(),
          end: Joi.string().required()
        })
        )
      }).optional(),
  coverImage: Joi.string().required().label('Cover image'),
  galleryImages: Joi.array().required().items(Joi.string()).label('Gallery images'),
  coverAudioFile: Joi.string().optional().label('Cover audio'),
  galleryAudioFiles: Joi.array().items(Joi.string()).optional().label('Gallery audio files'),
  items: Joi.array().items(itemSchema).optional().label('Items array'),
  categories: Joi.array().items(Joi.string()),
  subCategories: Joi.array().items(Joi.string()),
  genres: Joi.array().items(Joi.string()).optional(),
  maxOccupancy: Joi.number().required(),
  isSmokingAllowed: Joi.boolean().optional(),
  city: Joi.string().optional().allow('', null),
  address: Joi.string().optional(),
  phone: Joi.string().optional(),
  website: Joi.string().uri().optional().allow('', null),
  socials: Joi.object({
    instagram: Joi.string().uri().optional().allow('', null),
    facebook: Joi.string().uri().optional().allow('', null)
  }).optional(),
  lat: Joi.number().optional(),
  lng: Joi.number().optional(),
  isWheelchairAccessible: Joi.boolean().optional(),
  isSelfService: Joi.boolean().optional(),
  parking: Joi.string().valid('none', 'free', 'paid').optional().default('none'),
  createdAt: Joi.date().default(Date.now).label('Creation Date'),
  isFeatured: Joi.boolean().optional()
});

const validateStudio = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = schema.validate(req.body);
  if (error) {
    handleJoiError(error);
  } else {
    next();
  }
};

export default validateStudio;
