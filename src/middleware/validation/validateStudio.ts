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

const portfolioItemSchema = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required(),
  artist: Joi.string().required(),
  type: Joi.string().valid('audio', 'video', 'album').required(),
  coverUrl: Joi.string().uri().optional().allow('', null),
  link: Joi.string().uri().required(),
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
  name: Joi.object({
    en: Joi.string().regex(/^[a-zA-Z0-9\s]*$/).min(3).max(20).required().label('English Name'),
    he: Joi.string().min(3).max(20).required().label('Hebrew Name')
  }).required(),
 
  subtitle: Joi.object({
    en: Joi.string().max(100).optional().allow('', null).label('English Subtitle'), 
    he: Joi.string().max(100).optional().allow('', null).label('Hebrew Subtitle')
  }).optional(),
 
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
  subCategories: Joi.array().items(Joi.string()).optional(),
  genres: Joi.array().items(Joi.string()).optional(),
  amenities: Joi.array().items(Joi.string()).optional(),
  equipment: Joi.array().items(
    Joi.object({
      category: Joi.string().required(),
      items: Joi.string().optional().allow('', null) // Raw text input
    })
  ).optional(),
  maxOccupancy: Joi.number().required(),
  size: Joi.number().optional(),
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
  parking: Joi.string().valid('private', 'street', 'paid', 'none').optional().default('none'),
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
  portfolio: Joi.array().items(portfolioItemSchema).optional(),
  socialLinks: socialLinksSchema
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
