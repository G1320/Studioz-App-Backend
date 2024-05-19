//Here we takes a handler function as an argument and return
// an asynchronous function that handles HTTP requests.
module.exports = handleRequest = (handler) => {
  return async (req, res, next) => {
    try {
      const result = await handler(req, res);
      if (result === null) {
        return res.status(204).send();
      } else if (result) {
        return res.json(result);
      }
    } catch (error) {
      console.error(error);
      next(error);
    }
  };
};
