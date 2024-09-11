const handleRequest = (handler) => {
    return async (req, res, next) => {
        try {
            const result = await handler(req, res);
            if (result === null) {
                res.status(204).send();
            }
            else if (result) {
                res.json(result);
            }
        }
        catch (error) {
            console.error(error);
            next(error);
        }
    };
};
export default handleRequest;
