import Joi from 'joi';
import handleJoiError from '../../utils/joiErrorHandler.js';
import { Request, Response, NextFunction } from '../../types/express.js';

const validateUser = (req: Request, res: Response, next: NextFunction) => {
  const schema = Joi.object({
    username: Joi.string().label('Username').optional(),
    firstName: Joi.string().label('First Name').optional(),
    lastName: Joi.string().label('Last Name').optional(),
    name: Joi.string().optional().label('Last Name'),
    avatar: Joi.string().label('Avatar').optional(),
    password: Joi.string().min(6).label('Password').optional(),
    isAdmin: Joi.boolean().label('Admin access').optional(),
    createdAt: Joi.date().default(Date.now).label('Creation Date'),
    updatedAt: Joi.date().default(Date.now).label('Last Update'),
    picture: Joi.string().label('Picture').optional(),
    sub: Joi.string().label('Sub').optional(),
    cart: Joi.object({
      items: Joi.array().items(
        Joi.object({
          name: Joi.string().optional(),
          price: Joi.number().optional(),
          total: Joi.number().optional(),
          itemId: Joi.string().optional(),
          quantity: Joi.number().optional().default(1),
          bookingDate: Joi.string().optional(),
          startTime: Joi.string().optional(),
          studioName: Joi.string().optional(),
          studioId: Joi.string().optional()
        })
      )
    }).optional(),
    });

  const { error } = schema.validate(req.body);
  error ? handleJoiError(error) : next();
};

export default validateUser;
