import Joi from 'joi';
import handleJoiError from '../../utils/joiErrorHandler.js';
const itemSchema = Joi.object({
    _id: Joi.string().optional(),
    idx: Joi.number().optional(),
    studioId: Joi.string().optional().label('Studio'),
    studioName: Joi.string().optional(),
    studioImgUrl: Joi.string().optional(),
    quantity: Joi.number().optional(),
});
const schema = Joi.object({
    _id: Joi.string().optional(),
    name: Joi.string()
        .regex(/^[a-zA-Z0-9\s]*$/)
        .min(2)
        .max(60)
        .required()
        .label('Studio name'),
    description: Joi.string().required().label('Studio description'),
    coverImage: Joi.string().optional().label('Cover image'),
    galleryImages: Joi.array().items(Joi.string()).optional().label('Gallery images'),
    coverAudioFile: Joi.string().optional().label('Cover audio'),
    galleryAudioFiles: Joi.array().items(Joi.string()).optional().label('Gallery audio files'),
    items: Joi.array().items(itemSchema).optional().label('Items array'),
    category: Joi.string().optional(),
    maxOccupancy: Joi.number().optional(),
    isSmokingAllowed: Joi.boolean().optional(),
    city: Joi.string().optional(),
    address: Joi.string().optional(),
    isWheelchairAccessible: Joi.boolean().optional(),
    isSelfService: Joi.boolean().optional(),
    createdAt: Joi.date().default(Date.now).label('Creation Date'),
    isFeatured: Joi.boolean().optional(),
    subCategory: Joi.string().optional(),
});
const validateStudio = (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        handleJoiError(error);
    }
    else {
        next();
    }
};
export default validateStudio;
