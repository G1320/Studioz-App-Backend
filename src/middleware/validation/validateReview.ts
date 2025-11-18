import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import handleJoiError from '../../utils/joiErrorHandler.js';

const reviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().label('Rating'),
  comment: Joi.string().allow('', null).max(1000).optional().label('Comment')
});

const validateReview = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = reviewSchema.validate(req.body ?? {});
  if (error) {
    handleJoiError(error);
  } else {
    next();
  }
};

export default validateReview;

