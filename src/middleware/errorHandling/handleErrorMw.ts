import { Request, Response, NextFunction } from 'express';

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

const isProduction = process.env.NODE_ENV === 'production';

const handleErrorMw = (
  err: ErrorWithStatusCode,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong!';

  console.error(message);

  const clientMessage = isProduction && statusCode >= 500
    ? 'Internal server error'
    : message;

  res.status(statusCode).send(clientMessage);
};

export default handleErrorMw;
