import ExpressError from './expressError.js';
const handleJoiError = (error) => {
    if (!error)
        return;
    const msg = error.details
        .map((el) => el.message)
        .join(',')
        .replace(/"/g, '');
    throw new ExpressError(msg, 400);
};
export default handleJoiError;
