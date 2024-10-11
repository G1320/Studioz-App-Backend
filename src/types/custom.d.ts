declare module 'cors' {
    import { RequestHandler } from 'express';
    function cors(options?: unknown): RequestHandler;
    export = cors;
  }
  
  declare module 'cookie-parser' {
    import { RequestHandler } from 'express';
    function cookieParser(secret?: string | string[], options?: unknown): RequestHandler;
    export = cookieParser;
  }
  
  declare module 'morgan' {
    import { Handler } from 'express';
    function morgan(format: string, options?: unknown): Handler;
    export = morgan;
  }