const Joi = require('joi');
const handleJoiError = require('../../utils/joiErrorHandler');

const validateStudio = (req, res, next) => {
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
    imgUrl: Joi.string().optional().label('Image URL'),
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
    category: Joi.string().optional(),
    subCategory: Joi.string().optional(),
  });

  const { error } = schema.validate(req.body);
  error ? handleJoiError(error) : next();
};

module.exports = validateStudio;
