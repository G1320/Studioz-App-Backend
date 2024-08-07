import ExpressError from '../../utils/expressError.js';
import { handleDbErrorMsg } from '../../utils/handleDbErrorMsg.js';
import { Request, Response, NextFunction } from 'express';

interface DatabaseError extends Error {
  name: string;
  stack?: string;
}

const handleDbErrorMw = (err: DatabaseError, req: Request, res: Response, next: NextFunction): void => {
  if (err.name === 'CastError') {
    err = new ExpressError(`Error when requesting data: ID format is Invalid.`, 400);
  } else if (['ValidationError', 'DisconnectedError', 'MongoError'].includes(err.name)) {
    err = new ExpressError(handleDbErrorMsg(err), 400);
  }
  console.error(err.stack);
  next(err);
};

export default handleDbErrorMw;
