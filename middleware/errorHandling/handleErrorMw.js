const handleErrorMw = (err, req, res, next) => {
  const { statusCode, message } = err;
  console.error(message);
  res.status(statusCode || 500).send(message || 'Something went wrong!');
};

module.exports = handleErrorMw;
