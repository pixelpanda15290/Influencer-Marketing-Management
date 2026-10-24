import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser, Role } from '../models/allModels';

export const COOKIE_NAME = 'token';
export const JWT_SECRET = process.env.JWT_SECRET || 'influencer_marketing_operations_secret_key_2026';

export interface AuthRequest extends Request {
  user?: IUser;
  userPermissions?: string[];
}


export const generateToken = (userId: string, role: string): string => {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '24h' });
};

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Read JWT from HttpOnly cookie (primary) or Authorization header (fallback)
  const token = req.cookies?.[COOKIE_NAME] || (() => {
    const authHeader = req.headers['authorization'];
    return authHeader && authHeader.split(' ')[1];
  })();

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    const user = await User.findById(decoded.id);

    if (!user || user.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'Invalid or inactive user account' });
    }

    // Verify token matches active session in MongoDB database
    if (user.activeToken !== undefined && user.activeToken !== token) {
      return res.status(401).json({ success: false, message: 'Session expired or invalidated. Please log in again.' });
    }

    req.user = user;

    // Fetch user permissions via Role
    const roleDoc = await Role.findOne({ name: user.role });
    req.userPermissions = roleDoc ? roleDoc.permissions : [];

    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const authenticateOrApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.INTERNAL_SERVICE_KEY;
  if (validKey && apiKey && apiKey === validKey) {
    return next();
  }
  return authenticateToken(req, res, next);
};
