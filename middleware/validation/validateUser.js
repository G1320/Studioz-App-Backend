const Joi = require('joi');
const handleJoiError = require('../../utils/joiErrorHandler');

const validateUser = (req, res, next) => {
  const schema = Joi.object({
    username: Joi.string().label('Username').optional(),
    firstName: Joi.string().label('First Name').optional(),
    lastName: Joi.string().label('Last Name').optional(),
    name: Joi.string().required().label('Last Name'),
    avatar: Joi.string().label('Avatar').optional(),
    password: Joi.string().min(6).label('Password').optional(),
    isAdmin: Joi.boolean().label('Admin access').optional(),
    createdAt: Joi.date().default(Date.now).label('Creation Date'),
    updatedAt: Joi.date().default(Date.now).label('Last Update'),
    picture: Joi.string().label('Picture').optional(),
    sub: Joi.string().label('Sub').optional(),
    updated_at: Joi.date().default(Date.now).label('Last Update'),
  });

  const { error } = schema.validate(req.body);
  error ? handleJoiError(error) : next();
};

module.exports = validateUser;
