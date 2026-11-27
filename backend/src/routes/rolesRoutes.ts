import { Router, Response } from 'express';
import { Role, Permission } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../config/constants';

const router = Router();

// GET /api/v1/roles
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    return res.status(200).json({ 
      success: true, 
      count: roles.length, 
      data: roles,
      message: roles.length === 0 ? 'No records found' : 'Roles fetched successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch roles', error });
  }
});

// GET /api/v1/roles/permissions
router.get('/permissions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const permissions = await Permission.find().sort({ module: 1, code: 1 });
    return res.status(200).json({ 
      success: true, 
      count: permissions.length, 
      data: permissions, 
      availableCodes: PERMISSIONS,
      message: permissions.length === 0 ? 'No records found' : 'Permissions fetched successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch permissions', error });
  }
});

// POST /api/v1/roles
router.post('/', authenticateToken, checkPermission('settings.update', 'employee.create', 'employee.update'), async (req: AuthRequest, res: Response) => {
  const { name, description, permissions } = req.body;
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    return res.status(400).json({ success: false, message: 'Role name is required' });
  }

  try {
    const escaped = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Role.findOne({ name: new RegExp(`^${escaped}$`, 'i') });
    if (existing) return res.status(400).json({ success: false, message: 'Role already exists' });

    const role = await Role.create({
      name: trimmedName,
      description,
      permissions: permissions || [],
      isSystemRole: false
    });

    return res.status(200).json({ success: true, message: 'Role created successfully', data: role });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create role', error });
  }
});

// PUT /api/v1/roles/:id
router.put('/:id', authenticateToken, checkPermission('settings.update', 'employee.update', 'employee.create'), async (req: AuthRequest, res: Response) => {
  const { description, permissions } = req.body;

  try {
    let role: any = null;
    if (req.params.id && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      role = await Role.findById(req.params.id);
    }
    if (!role) {
      role = await Role.findOne({ name: { $regex: new RegExp(`^${req.params.id}$`, 'i') } });
    }
    if (!role) {
      // Create system role if missing
      role = await Role.create({
        name: req.params.id,
        description: description || `Role for ${req.params.id}`,
        permissions: permissions || [],
        isSystemRole: true
      });
    } else {
      if (description !== undefined) role.description = description;
      if (permissions !== undefined) role.permissions = permissions;
      await role.save();
    }

    return res.status(200).json({ success: true, message: 'Role updated successfully', data: role });
  } catch (error) {
    console.error('Error updating role:', error);
    return res.status(500).json({ success: false, message: 'Failed to update role', error });
  }
});

export default router;
