import { Router, Response } from 'express';
import { Setting, Department } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { PLATFORMS, CONTENT_TYPES, TASK_STATUSES, PRIORITIES, DEPARTMENTS, DESIGNATIONS } from '../config/constants';
import { logActivity } from '../middleware/auditLog';

const router = Router();

// GET /api/v1/settings
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const dbSettings = await Setting.find();
    const dbDepartments = await Department.find({ status: 'Active' }).sort({ name: 1 });
    
    // Default fallback configurations
    const defaultSettings = {
      platforms: PLATFORMS,
      contentTypes: CONTENT_TYPES,
      taskStatuses: TASK_STATUSES,
      priorities: PRIORITIES,
      departments: dbDepartments.length > 0 ? dbDepartments.map(d => d.name) : DEPARTMENTS,
      departmentObjects: dbDepartments,
      designations: DESIGNATIONS
    };

    // Override defaults with DB settings if present
    const settingsMap: any = { ...defaultSettings };
    dbSettings.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    return res.status(200).json({ success: true, data: settingsMap, message: 'Settings fetched successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch settings', error });
  }
});

// POST /api/v1/settings
router.post('/', authenticateToken, checkPermission('settings.update', 'employee.update'), async (req: AuthRequest, res: Response) => {
  const { key, value, category, description } = req.body;

  if (!key || value === undefined) {
    return res.status(400).json({ success: false, message: 'Key and Value are required' });
  }

  try {
    const setting = await Setting.findOneAndUpdate(
      { key },
      { value, category: category || 'General', description },
      { upsert: true, new: true }
    );

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'Admin',
      action: 'UPDATE_SETTING',
      module: 'System Settings',
      entity: 'Setting',
      entityId: key,
      newValue: { key, value }
    });

    return res.status(200).json({ success: true, message: 'Setting updated successfully', data: setting });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update setting', error });
  }
});

export default router;
