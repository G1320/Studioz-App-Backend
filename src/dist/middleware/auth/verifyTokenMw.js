import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '../../config/index.js';
const { TokenExpiredError } = jwt;
const verifyTokenMw = (req, res, next) => {
    const token = req.signedCookies.accessToken;
    if (!token) {
        res.status(401).json({ message: 'Access denied. No token provided.' });
        return;
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET_KEY);
        req.decodedJwt = decoded;
        next();
    }
    catch (error) {
        if (error instanceof TokenExpiredError) {
            res.status(401).json({ message: 'Token expired' });
        }
        else {
            res.status(400).json({ message: 'Invalid access token' });
        }
    }
};
export default verifyTokenMw;
