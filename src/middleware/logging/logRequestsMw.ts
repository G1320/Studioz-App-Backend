import morgan from 'morgan';

const logRequestsMw = morgan('tiny');

export default logRequestsMw;
