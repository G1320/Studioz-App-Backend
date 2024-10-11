import { Request, Response, NextFunction } from 'express';

type HandlerFunction = (req: Request, res: Response) => Promise<unknown>;

const handleRequest = (handler: HandlerFunction) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await handler(req, res);
      if (result === null) {
        res.status(204).send();
      } else if (result) {
        res.json(result);
      }
    } catch (error) {
      console.error(error);
      next(error);
    }
  };
};

export default handleRequest;
