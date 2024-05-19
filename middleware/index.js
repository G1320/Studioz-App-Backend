const validateUser = require('./validation/validateUser');
const validateStudio = require('./validation/validateStudio.js');
const logRequestsMw = require('./logging/logRequestsMw');
const handleDbErrorMw = require('./errorHandling/handleDbErrorMw');
const handleErrorMw = require('./errorHandling/handleErrorMw');
const verifyTokenMw = require('./auth/verifyTokenMw');

module.exports = {
  validateUser,
  validateStudio,
  logRequestsMw,
  handleDbErrorMw,
  handleErrorMw,
  verifyTokenMw,
};
