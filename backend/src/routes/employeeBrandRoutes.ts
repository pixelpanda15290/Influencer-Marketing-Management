import { Router, Response } from 'express';
import { EmployeeBrand, Notification, Employee, Brand } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { logActivity } from '../middleware/auditLog';
import { getAssignmentTypeFromRole, BRAND_ASSIGNMENT_LABEL } from '../config/constants';

const router = Router();

// GET /api/v1/employee-brands
router.get('/', authenticateToken, checkPermission('brand.view'), async (req: AuthRequest, res: Response) => {
  const { employeeId, brandId, status, assignmentType } = req.query;
  const filter: any = { isDeleted: { $ne: true } };
  if (employeeId) filter.employeeId = employeeId;
  if (brandId) filter.brandId = brandId;
  if (status) filter.status = status;
  if (assignmentType) filter.assignmentType = Number(assignmentType);

  try {
    const totalCount = await EmployeeBrand.countDocuments(filter);
    const pageNum = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limitNum = req.query.limit ? Math.max(1, Number(req.query.limit)) : 10;

    let query = EmployeeBrand.find(filter)
      .populate('employeeId', 'name employeeId designation department email role')
      .populate('brandId', 'brandName brandId logo industry')
      .populate('assignedBy', 'name role')
      .sort({ createdAt: -1 });

    if (pageNum !== undefined) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const assignments = await query;

    return res.status(200).json({ 
      success: true, 
      count: assignments.length, 
      data: assignments,
      pagination: {
        page: pageNum || 1,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limitNum))
      },
      message: assignments.length === 0 ? 'No records found' : 'Assignments fetched successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch assignments', error });
  }
});

// GET /api/v1/employee-brands/matrix-summary - 3-Way Brand Allocation (Posting, Barter, Paid)
router.get('/matrix-summary', authenticateToken, checkPermission('brand.view'), async (req: AuthRequest, res: Response) => {
  try {
    const [brands, assignments] = await Promise.all([
      Brand.find({ status: 'Active', isDeleted: { $ne: true } }).sort({ brandName: 1 }).lean(),
      EmployeeBrand.find({ status: 'Active', isDeleted: { $ne: true } })
        .populate('employeeId', 'name employeeId role designation email')
        .lean()
    ]);

    const matrix = brands.map(b => {
      const brandAssigns = assignments.filter(a => a.brandId.toString() === b._id.toString());
      return {
        brand: b,
        posting: brandAssigns.find(a => a.assignmentType === 1)?.employeeId || null,
        barter: brandAssigns.find(a => a.assignmentType === 2)?.employeeId || null,
        paid: brandAssigns.find(a => a.assignmentType === 3)?.employeeId || null,
      };
    });

    return res.status(200).json({ success: true, count: matrix.length, data: matrix });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch brand matrix summary', error });
  }
});

// POST /api/v1/employee-brands/assign
router.post('/assign', authenticateToken, checkPermission('brand.assign'), async (req: AuthRequest, res: Response) => {
  const { employeeId, brandId, responsibility, priority, startDate, endDate, assignmentType } = req.body;

  if (!employeeId || !brandId) {
    return res.status(400).json({ success: false, message: 'Employee and Brand IDs are required' });
  }

  try {
    const emp = await Employee.findById(employeeId);
    let finalType = Number(assignmentType);
    if (![1, 2, 3].includes(finalType)) {
      finalType = getAssignmentTypeFromRole(emp?.role || emp?.designation);
    }

    // Check if active assignment exists for this brand IN THIS SPECIFIC assignmentType (1, 2, or 3)
    const existing = await EmployeeBrand.findOne({ brandId, assignmentType: finalType, status: 'Active' });
    if (existing) {
      if (existing.employeeId.toString() === employeeId.toString()) {
        return res.status(400).json({
          success: false,
          message: `Employee is already assigned to this brand for ${BRAND_ASSIGNMENT_LABEL[finalType] || 'this division'}`
        });
      }
      // Reassign within this division
      existing.status = 'Removed';
      existing.endDate = new Date();
      await existing.save();
    }

    const defaultResp = finalType === 1 ? 'Posting & Content Management' : (finalType === 2 ? 'Barter Collab Management' : 'Paid Collab Management');

    const assignment = await EmployeeBrand.create({
      employeeId,
      brandId,
      assignmentType: finalType,
      assignedBy: req.user?._id,
      responsibility: responsibility || defaultResp,
      priority: priority || 'High',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      status: 'Active'
    });

    const populated = await EmployeeBrand.findById(assignment._id)
      .populate('employeeId', 'name email userId role designation')
      .populate('brandId', 'brandName');

    // Notify employee if user account exists
    const empDoc = populated?.employeeId as any;
    const brandDoc = populated?.brandId as any;
    if (empDoc && empDoc.userId) {
      await Notification.create({
        userId: empDoc.userId,
        title: `New Brand Assigned (${BRAND_ASSIGNMENT_LABEL[finalType]})`,
        message: `You have been assigned to manage ${brandDoc?.brandName || 'a brand'} for ${BRAND_ASSIGNMENT_LABEL[finalType]}.`,
        type: 'Assignment',
        relatedId: (brandId as string)
      });
    }

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action: 'ASSIGN_EMPLOYEE_BRAND',
      module: 'Employee-Brand Assignment',
      entity: 'EmployeeBrand',
      entityId: (assignment._id as any).toString(),
      newValue: { employeeId, brandId, assignmentType: finalType, responsibility }
    });

    return res.status(200).json({ success: true, message: 'Employee assigned to brand successfully', data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to assign employee to brand', error });
  }
});

// PATCH /api/v1/employee-brands/:id/unassign
router.patch('/:id/unassign', authenticateToken, checkPermission('brand.assign'), async (req: AuthRequest, res: Response) => {
  try {
    const assignment = await EmployeeBrand.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'No record exists for this assignment' });

    assignment.status = 'Removed';
    assignment.endDate = new Date();
    await assignment.save();

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action: 'UNASSIGN_EMPLOYEE_BRAND',
      module: 'Employee-Brand Assignment',
      entity: 'EmployeeBrand',
      entityId: assignment._id.toString(),
      oldValue: { status: 'Active' },
      newValue: { status: 'Removed' }
    });

    return res.status(200).json({ success: true, message: 'Brand assignment unassigned successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to unassign brand', error });
  }
});

// PUT /api/v1/employee-brands/:id
router.put('/:id', authenticateToken, checkPermission('brand.assign'), async (req: AuthRequest, res: Response) => {
  const { responsibility, priority, status, endDate, assignmentType } = req.body;

  try {
    const assignment = await EmployeeBrand.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'No record exists for this assignment' });

    const oldValue = { ...assignment.toObject() };

    if (responsibility) assignment.responsibility = responsibility;
    if (priority) assignment.priority = priority;
    if (status) assignment.status = status;
    if (endDate) assignment.endDate = new Date(endDate);
    if (assignmentType && [1, 2, 3].includes(Number(assignmentType))) {
      assignment.assignmentType = Number(assignmentType) as any;
    }

    await assignment.save();

    const populated = await EmployeeBrand.findById(assignment._id)
      .populate('employeeId', 'name email userId')
      .populate('brandId', 'brandName');

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action: 'UPDATE_EMPLOYEE_BRAND',
      module: 'Employee-Brand Assignment',
      entity: 'EmployeeBrand',
      entityId: assignment._id.toString(),
      oldValue,
      newValue: assignment.toObject()
    });

    return res.status(200).json({ success: true, message: 'Assignment updated successfully', data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update assignment', error });
  }
});

// POST /api/v1/employee-brands/sync-employee
// Syncs brand assignments for a specific employee within their division (assignmentType: 1, 2, or 3)
router.post('/sync-employee', authenticateToken, checkPermission('brand.assign'), async (req: AuthRequest, res: Response) => {
  const { employeeId, brandIds, responsibility, priority, assignmentType } = req.body;

  if (!employeeId || !Array.isArray(brandIds)) {
    return res.status(400).json({ success: false, message: 'Employee ID and array of Brand IDs are required' });
  }

  try {
    const emp = await Employee.findById(employeeId);
    let finalType = Number(assignmentType);
    if (![1, 2, 3].includes(finalType)) {
      finalType = getAssignmentTypeFromRole(emp?.role || emp?.designation);
    }

    const defaultResp = finalType === 1 ? 'Posting & Content Management' : (finalType === 2 ? 'Barter Collab Management' : 'Paid Collab Management');

    // 1. Remove active assignments for this employee strictly within this assignmentType that are no longer in brandIds
    await EmployeeBrand.deleteMany({
      employeeId,
      assignmentType: finalType,
      brandId: { $nin: brandIds }
    });

    // 2. Remove other employees assigned to these brands strictly within this SAME assignmentType
    if (brandIds.length > 0) {
      await EmployeeBrand.deleteMany({
        employeeId: { $ne: employeeId },
        assignmentType: finalType,
        brandId: { $in: brandIds }
      });
    }

    // 3. Create or update assignments for selected brandIds with this assignmentType
    for (const bId of brandIds) {
      const existing = await EmployeeBrand.findOne({ employeeId, brandId: bId, assignmentType: finalType });
      if (existing) {
        existing.status = 'Active';
        if (responsibility) existing.responsibility = responsibility;
        if (priority) existing.priority = priority;
        await existing.save();
      } else {
        await EmployeeBrand.create({
          employeeId,
          brandId: bId,
          assignmentType: finalType,
          assignedBy: req.user?._id,
          responsibility: responsibility || defaultResp,
          priority: priority || 'High',
          startDate: new Date(),
          status: 'Active'
        });
      }
    }

    const updatedAssignments = await EmployeeBrand.find({ employeeId, assignmentType: finalType, status: 'Active' })
      .populate('employeeId', 'name employeeId designation department email role')
      .populate('brandId', 'brandName brandId logo industry');

    return res.status(200).json({ 
      success: true, 
      message: `Brand assignments updated successfully for ${BRAND_ASSIGNMENT_LABEL[finalType]}`, 
      data: updatedAssignments 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to sync employee brand assignments', error });
  }
});

// POST /api/v1/employee-brands/transfer
// Transfers a brand's assignment within a specific division (1 = Posting, 2 = Barter, 3 = Paid)
router.post('/transfer', authenticateToken, checkPermission('brand.assign'), async (req: AuthRequest, res: Response) => {
  const { brandId, fromEmployeeId, toEmployeeId, responsibility, priority, assignmentType } = req.body;

  if (!brandId || !toEmployeeId) {
    return res.status(400).json({ success: false, message: 'Brand ID and destination Employee ID are required' });
  }

  if (fromEmployeeId && fromEmployeeId === toEmployeeId) {
    return res.status(400).json({ success: false, message: 'Source and destination employees must be different' });
  }

  try {
    const toEmp = await Employee.findById(toEmployeeId);
    let finalType = Number(assignmentType);
    if (![1, 2, 3].includes(finalType)) {
      finalType = getAssignmentTypeFromRole(toEmp?.role || toEmp?.designation);
    }

    const defaultResp = finalType === 1 ? 'Posting & Content Management' : (finalType === 2 ? 'Barter Collab Management' : 'Paid Collab Management');

    // 1. Remove existing active assignment for this brand STRICTLY in this assignmentType
    await EmployeeBrand.deleteMany({
      brandId,
      assignmentType: finalType
    });

    // 2. Create new active assignment for destination employee in this division
    const newAssignment = await EmployeeBrand.create({
      employeeId: toEmployeeId,
      brandId,
      assignmentType: finalType,
      assignedBy: req.user?._id,
      responsibility: responsibility || defaultResp,
      priority: priority || 'High',
      startDate: new Date(),
      status: 'Active'
    });

    const populated = await EmployeeBrand.findById(newAssignment._id)
      .populate('employeeId', 'name employeeId designation department email userId role')
      .populate('brandId', 'brandName brandId logo industry');

    const empDoc = populated?.employeeId as any;
    const brandDoc = populated?.brandId as any;

    if (empDoc && empDoc.userId) {
      await Notification.create({
        userId: empDoc.userId,
        title: `Brand Transferred to You (${BRAND_ASSIGNMENT_LABEL[finalType]})`,
        message: `Brand "${brandDoc?.brandName || 'Brand'}" has been transferred and assigned to you for ${BRAND_ASSIGNMENT_LABEL[finalType]}.`,
        type: 'Assignment',
        relatedId: (brandId as string)
      });
    }

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action: 'TRANSFER_EMPLOYEE_BRAND',
      module: 'Employee-Brand Assignment',
      entity: 'EmployeeBrand',
      entityId: (newAssignment._id as any).toString(),
      newValue: { brandId, fromEmployeeId, toEmployeeId, assignmentType: finalType }
    });

    return res.status(200).json({
      success: true,
      message: `Brand "${brandDoc?.brandName || 'Brand'}" (${BRAND_ASSIGNMENT_LABEL[finalType]}) successfully transferred to ${empDoc?.name || 'new employee'}`,
      data: populated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to transfer brand assignment', error });
  }
});

// DELETE /api/v1/employee-brands/employee/:employeeId
router.delete('/employee/:employeeId', authenticateToken, checkPermission('brand.assign'), async (req: AuthRequest, res: Response) => {
  const { assignmentType } = req.query;
  const filter: any = { employeeId: req.params.employeeId };
  if (assignmentType && [1, 2, 3].includes(Number(assignmentType))) {
    filter.assignmentType = Number(assignmentType);
  }

  try {
    await EmployeeBrand.updateMany(
      filter,
      { status: 'Removed', isDeleted: true, deletedAt: new Date(), deletedBy: req.user?._id }
    );
    return res.status(200).json({ success: true, message: 'Brand assignments removed for employee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete assignments', error });
  }
});

export default router;
