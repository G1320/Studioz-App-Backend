import { Request, Response } from 'express';

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

const handleErrorMw = (
  err: ErrorWithStatusCode,
  req: Request,
  res: Response,
): void => {
  const { statusCode, message } = err;
  console.error(message);
  res.status(statusCode || 500).send(message || 'Something went wrong!');
};

export default handleErrorMw;
