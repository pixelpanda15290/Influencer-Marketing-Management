import { Router, Request, Response } from 'express';
import { Department } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { logActivity } from '../middleware/auditLog';

const router = Router();

// GET /api/v1/departments - Get active departments (public/authenticated for signup & dropdowns)
router.get('/', async (req: Request, res: Response) => {
  try {
    const departments = await Department.find({ isDeleted: { $ne: true }, status: { $in: [0, 'Active'] } }).sort({ name: 1 });
    return res.status(200).json({
      success: true,
      data: departments,
      message: 'Active departments retrieved successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
      error: (error as Error).message
    });
  }
});

// GET /api/v1/departments/all - Get all departments including inactive (Super Admin / Admin / Managers)
router.get('/all', authenticateToken, checkPermission('settings.view', 'employee.view'), async (req: AuthRequest, res: Response) => {
  try {
    const totalCount = await Department.countDocuments({ isDeleted: { $ne: true } });
    const pageNum = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limitNum = req.query.limit ? Math.max(1, Number(req.query.limit)) : 10;

    let query = Department.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    if (pageNum !== undefined) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }
    const departments = await query;
    return res.status(200).json({
      success: true,
      data: departments,
      pagination: {
        page: pageNum || 1,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limitNum))
      },
      message: 'All departments retrieved successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch all departments',
      error: (error as Error).message
    });
  }
});

// POST /api/v1/departments - Create a new department (Super Admin / Admin / Managers)
router.post('/', authenticateToken, checkPermission('settings.update', 'employee.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, description, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Department name is required' });
    }

    const existingDept = await Department.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isDeleted: { $ne: true }
    });
    if (existingDept) {
      return res.status(400).json({ success: false, message: `Department with name '${name.trim()}' already exists` });
    }

    const department = new Department({
      name: name.trim(),
      code: code ? code.trim() : undefined,
      description: description ? description.trim() : '',
      status: (status === 1 || status === 'Inactive' || status === '1') ? 1 : 0
    });

    await department.save();

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'Super Admin',
      action: 'CREATE_DEPARTMENT',
      module: 'Department Management',
      entity: 'Department',
      entityId: String(department._id),
      newValue: { name: department.name, code: department.code, status: department.status }
    });

    return res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create department',
      error: (error as Error).message
    });
  }
});

// PUT /api/v1/departments/:id - Update an existing department (Super Admin / Admin / Managers)
router.put('/:id', authenticateToken, checkPermission('settings.update', 'employee.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, description, status } = req.body;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    if (name && name.trim() && name.trim().toLowerCase() !== department.name.toLowerCase()) {
      const existingDept = await Department.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        isDeleted: { $ne: true }
      });
      if (existingDept) {
        return res.status(400).json({ success: false, message: `Department with name '${name.trim()}' already exists` });
      }
      department.name = name.trim();
    }

    if (code !== undefined) department.code = code ? code.trim() : '';
    if (description !== undefined) department.description = description ? description.trim() : '';
    if (status !== undefined) department.status = (status === 1 || status === 'Inactive' || status === '1') ? 1 : 0;

    await department.save();

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'Super Admin',
      action: 'UPDATE_DEPARTMENT',
      module: 'Department Management',
      entity: 'Department',
      entityId: String(department._id),
      newValue: { name: department.name, code: department.code, status: department.status }
    });

    return res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: department
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update department',
      error: (error as Error).message
    });
  }
});

// DELETE /api/v1/departments/:id - Delete a department (Super Admin / Admin / Managers)
router.delete('/:id', authenticateToken, checkPermission('settings.update', 'employee.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    department.isDeleted = true;
    department.deletedAt = new Date();
    department.status = 1;
    await department.save();

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'Super Admin',
      action: 'SOFT_DELETE_DEPARTMENT',
      module: 'Department Management',
      entity: 'Department',
      entityId: id,
      newValue: { name: department.name, isDeleted: true, deletedAt: department.deletedAt }
    });

    return res.status(200).json({
      success: true,
      message: 'Department soft deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete department',
      error: (error as Error).message
    });
  }
});

export default router;
