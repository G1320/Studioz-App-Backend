declare module 'cors' {
    import { RequestHandler } from 'express';
    function cors(options?: any): RequestHandler;
    export = cors;
  }
  
  declare module 'cookie-parser' {
    import { RequestHandler } from 'express';
    function cookieParser(secret?: string | string[], options?: any): RequestHandler;
    export = cookieParser;
  }
  
  declare module 'morgan' {
    import { Handler } from 'express';
    function morgan(format: string, options?: any): Handler;
    export = morgan;
  }