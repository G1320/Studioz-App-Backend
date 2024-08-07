import Joi from 'joi';
import ExpressError from './expressError.js';

const handleJoiError = (error: Joi.ValidationError | null): void => {
  if (!error) return;
  const msg = error.details
    .map((el) => el.message)
    .join(',')
    .replace(/"/g, '');
  throw new ExpressError(msg, 400);
};

export default handleJoiError;
