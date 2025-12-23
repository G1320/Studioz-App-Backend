import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import handleJoiError from '../../utils/joiErrorHandler.js';

const translationSchema = Joi.object({
  en: Joi.string().allow('', null).optional(),
  he: Joi.string().allow('', null).optional()
}).optional();

const reviewCreateSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().label('Rating'),
  name: translationSchema.label('Name'),
  comment: translationSchema.label('Comment')
});

const reviewUpdateSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional().label('Rating'),
  name: translationSchema.label('Name'),
  comment: translationSchema.label('Comment')
}).or('rating', 'name', 'comment'); // At least one field must be provided

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

