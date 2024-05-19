const Morgan = require('morgan');

const logRequestsMw = Morgan('tiny');

module.exports = logRequestsMw;
