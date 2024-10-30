import { Request, Response, NextFunction } from 'express';

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

const handleErrorMw = (
  err: ErrorWithStatusCode,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { statusCode, message } = err;
  console.error(message);
  res.status(statusCode || 500).send(message || 'Something went wrong!');
};

export default handleErrorMw;
