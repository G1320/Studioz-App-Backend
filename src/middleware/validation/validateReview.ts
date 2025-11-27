import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import handleJoiError from '../../utils/joiErrorHandler.js';

const reviewCreateSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().label('Rating'),
  comment: Joi.string().allow('', null).max(1000).optional().label('Comment')
});

const reviewUpdateSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional().label('Rating'),
  comment: Joi.string().allow('', null).max(1000).optional().label('Comment')
}).or('rating', 'comment'); // At least one field must be provided

const validatePayload =
  (schema: Joi.ObjectSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body ?? {});
    if (error) {
      handleJoiError(error);
    } else {
      next();
    }
  };

export const validateReviewCreate = validatePayload(reviewCreateSchema);
export const validateReviewUpdate = validatePayload(reviewUpdateSchema);

export default validateReviewUpdate;

