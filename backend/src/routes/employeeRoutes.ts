import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Employee, User } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { logActivity } from '../middleware/auditLog';

const router = Router();

// GET /api/v1/employees
router.get('/', authenticateToken, checkPermission('employee.view'), async (req: AuthRequest, res: Response) => {
  try {
    const filter = { isDeleted: { $ne: true } };
    const totalCount = await Employee.countDocuments(filter);
    const pageNum = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limitNum = req.query.limit ? Math.max(1, Number(req.query.limit)) : 10;

    let query = Employee.find(filter)
      .populate('reportingManagerId', 'name employeeId designation')
      .populate('department', 'name code description status')
      .sort({ createdAt: -1 });

    if (pageNum !== undefined) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const employees = await query;
    return res.status(200).json({ 
      success: true, 
      count: employees.length, 
      data: employees,
      pagination: {
        page: pageNum || 1,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limitNum))
      },
      message: employees.length === 0 ? 'No records found' : 'Employees fetched successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching employees', error });
  }
});

// GET /api/v1/employees/pending-approvals
router.get('/pending-approvals', authenticateToken, checkPermission('employee.view'), async (req: AuthRequest, res: Response) => {
  try {
    // Auto-fix: ensure all Active employees are marked isApproved
    await User.updateMany({ status: 'Active', isApproved: false }, { isApproved: true });
    await Employee.updateMany({ status: 'Active', isApproved: false }, { isApproved: true });

    // Find ONLY employees who have completed email OTP verification and are awaiting manager approval
    const pendingEmployees = await Employee.find({
      isApproved: false,
      emailVerified: true,
      status: 'Pending Approval',
      isDeleted: { $ne: true }
    }).populate('department', 'name code description status').sort({ createdAt: -1 });

    console.log('[Pending Approvals Debug] Matched verified pending:', pendingEmployees.length);

    return res.status(200).json({
      success: true,
      count: pendingEmployees.length,
      data: pendingEmployees,
      message: pendingEmployees.length === 0 ? 'No pending signup approvals' : 'Pending employee approvals fetched'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pending approvals', error });
  }
});

// GET /api/v1/employees/:id
router.get('/:id', authenticateToken, checkPermission('employee.view'), async (req: AuthRequest, res: Response) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('reportingManagerId', 'name employeeId email designation').populate('department', 'name code description status');
    if (!employee) return res.status(404).json({ success: false, message: 'No record exists for this employee' });
    return res.status(200).json({ success: true, data: employee, message: 'Employee fetched successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching employee', error });
  }
});

// POST /api/v1/employees
router.post('/', authenticateToken, checkPermission('employee.create'), async (req: AuthRequest, res: Response) => {
  const { name, email, phone, department, designation, role, reportingManagerId, joiningDate, password } = req.body;

  if (!name || !email || !phone || !department || !designation || !role) {
    return res.status(400).json({ success: false, message: 'Required employee fields missing' });
  }

  if (!email || !email.trim().toLowerCase().endsWith('@ad2ship.com')) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error: Employee work email must use @ad2ship.com domain address.'
    });
  }

  try {
    const existingEmp = await Employee.findOne({ email: email.toLowerCase() });
    if (existingEmp) {
      return res.status(400).json({ success: false, message: 'Employee email already exists' });
    }

    // Auto-generate employeeId
    const existingEmps = await Employee.find({ employeeId: /^EMP-\d+$/ }, { employeeId: 1 });
    let maxEmpNum = 1000;
    existingEmps.forEach(e => {
      const match = e.employeeId?.match(/^EMP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxEmpNum) maxEmpNum = num;
      }
    });
    let nextEmpNum = maxEmpNum + 1;
    let employeeId = `EMP-${nextEmpNum}`;
    while (await Employee.exists({ employeeId })) {
      nextEmpNum++;
      employeeId = `EMP-${nextEmpNum}`;
    }

    // Create User login account
    const hashedPassword = await bcrypt.hash(password || 'Employee@123', 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      employeeId,
      status: 'Active'
    });

    const employee = await Employee.create({
      employeeId,
      userId: user._id,
      name,
      email: email.toLowerCase(),
      phone,
      department,
      designation,
      role,
      reportingManagerId: reportingManagerId || undefined,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      status: 'Active'
    });

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action: 'CREATE_EMPLOYEE',
      module: 'Employee Management',
      entity: 'Employee',
      entityId: (employee._id as any).toString(),
      newValue: { employeeId, name, email, role, department }
    });

    return res.status(200).json({ success: true, message: 'Employee created successfully', data: employee });
  } catch (error) {
    console.error('Create employee error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create employee', error });
  }
});

// PUT /api/v1/employees/:id
router.put('/:id', authenticateToken, checkPermission('employee.update'), async (req: AuthRequest, res: Response) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'No record exists for this employee' });

    const oldValue = { ...employee.toObject() };
    const { name, phone, department, designation, role, reportingManagerId, status } = req.body;

    if (name) employee.name = name;
    if (phone) employee.phone = phone;
    if (department) employee.department = department;
    if (designation) employee.designation = designation;
    if (role) employee.role = role;
    if (reportingManagerId !== undefined) employee.reportingManagerId = reportingManagerId || undefined;
    if (status) employee.status = status;

    await employee.save();

    // Update corresponding user record if role/status/name changed
    const userConditions: any[] = [];
    if (employee.userId) userConditions.push({ _id: employee.userId });
    if (employee.employeeId) userConditions.push({ employeeId: employee.employeeId });
    if (employee.email) userConditions.push({ email: employee.email.toLowerCase().trim() });
    if (userConditions.length > 0) {
      await User.findOneAndUpdate(
        { $or: userConditions },
        { name: employee.name, role: employee.role, status: employee.status, employeeId: employee.employeeId }
      );
    }

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action: 'UPDATE_EMPLOYEE',
      module: 'Employee Management',
      entity: 'Employee',
      entityId: (employee._id as any).toString(),
      oldValue,
      newValue: employee.toObject()
    });

    return res.status(200).json({ success: true, message: 'Employee updated successfully', data: employee });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update employee', error });
  }
});

// DELETE /api/v1/employees/:id
router.delete('/:id', authenticateToken, checkPermission('employee.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee || employee.isDeleted) return res.status(404).json({ success: false, message: 'No record exists for this employee' });

    employee.isDeleted = true;
    employee.deletedAt = new Date();
    employee.deletedBy = req.user?._id;
    employee.status = 'Inactive';
    await employee.save();

    await User.updateOne({ email: employee.email }, { status: 'Inactive' });

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action: 'DELETE_EMPLOYEE',
      module: 'Employee Management',
      entity: 'Employee',
      entityId: req.params.id,
      oldValue: employee.toObject()
    });

    return res.status(200).json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete employee', error });
  }
});


// PUT /api/v1/employees/:id/approve (Manager approves user account and assigns role/designation)
router.put('/:id/approve', authenticateToken, checkPermission('employee.update'), async (req: AuthRequest, res: Response) => {
  const { role, designation, department } = req.body;

  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found' });
    }

    const assignedRole = role || employee.role || 'Employee';
    const assignedDesignation = designation || employee.designation || 'Influencer Executive';
    const assignedDepartment = department || employee.department || 'Influencer Marketing';

    employee.status = 'Active';
    employee.isApproved = true;
    employee.role = assignedRole;
    employee.designation = assignedDesignation;
    employee.department = assignedDepartment;
    await employee.save();

    const approveUserConditions: any[] = [];
    if (employee.userId) approveUserConditions.push({ _id: employee.userId });
    if (employee.employeeId) approveUserConditions.push({ employeeId: employee.employeeId });
    if (employee.email) approveUserConditions.push({ email: employee.email.toLowerCase().trim() });
    if (approveUserConditions.length > 0) {
      await User.findOneAndUpdate(
        { $or: approveUserConditions },
        { status: 'Active', isApproved: true, role: assignedRole, employeeId: employee.employeeId, name: employee.name }
      );
    }

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'Manager',
      action: 'APPROVE_EMPLOYEE_SIGNUP',
      module: 'Employee Management',
      entity: 'Employee',
      entityId: (employee._id as any).toString(),
      newValue: { status: 'Active', isApproved: true, role: assignedRole, designation: assignedDesignation }
    });

    return res.status(200).json({
      success: true,
      message: `Account for ${employee.name} approved successfully as ${assignedRole}!`,
      data: employee
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to approve employee signup', error });
  }
});

export default router;
