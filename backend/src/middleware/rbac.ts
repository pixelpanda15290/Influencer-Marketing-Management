import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { ROLE_DEFAULT_PERMISSIONS } from '../config/constants';

export const checkPermission = (...requiredPermissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Super Admin & Admin have all permissions automatically
    if (req.user.role === 'Super Admin' || req.user.role === 'Admin') {
      return next();
    }

    const permissions = req.userPermissions || [];
    const defaultRolePerms = ROLE_DEFAULT_PERMISSIONS[req.user.role] || [];
    const allUserPerms = [...permissions, ...defaultRolePerms];

    const hasPerm = requiredPermissions.some(perm => allUserPerms.includes(perm));

    if (!hasPerm) {
      return res.status(403).json({ 
        success: false, 
        message: `Forbidden: Missing required permission '${requiredPermissions.join(' or ')}'` 
      });
    }

    next();
  };
};

export const checkRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource` 
      });
    }

    next();
  };
};
