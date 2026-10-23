import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Brand, EmployeeBrand, Employee, User } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { logActivity } from '../middleware/auditLog';
import { getEmployeeForAuthUser } from '../utils/employeeHelper';
import { getAssignmentTypeFromRole } from '../config/constants';

const router = Router();

// GET /api/v1/brands
router.get('/', authenticateToken, checkPermission('brand.view'), async (req: AuthRequest, res: Response) => {
  try {
    let filter: any = { isDeleted: { $ne: true } };

    // Filter brands to ONLY those assigned if the user is an employee or member
    const userRole = (req.user?.role || '').toLowerCase();
    const isScopedRole = userRole === 'employee' || userRole === 'member' || userRole === 'posting & content executive' || userRole === 'barter collab executive' || userRole === 'paid collab executive';
    if (isScopedRole) {
      const emp = await getEmployeeForAuthUser(req.user);
      if (emp) {
        const assignFilter: any = { employeeId: emp._id, status: 'Active', isDeleted: { $ne: true } };
        if (req.query.assignmentType && [1, 2, 3].includes(Number(req.query.assignmentType))) {
          assignFilter.assignmentType = Number(req.query.assignmentType);
        } else if (userRole.includes('posting') || userRole.includes('barter') || userRole.includes('paid')) {
          assignFilter.assignmentType = getAssignmentTypeFromRole(emp.role || emp.designation || req.user?.role);
        }
        let assignments = await EmployeeBrand.find(assignFilter);
        if (assignments.length === 0 && !req.query.assignmentType) {
          assignments = await EmployeeBrand.find({ employeeId: emp._id, status: 'Active', isDeleted: { $ne: true } });
        }
        const assignedBrandIds = assignments.map(a => a.brandId);
        filter._id = { $in: assignedBrandIds };
      } else {
        filter._id = { $in: [] };
      }
    }

    // Brand type filtering
    const brandType = req.query.brandType ? String(req.query.brandType).trim() : '';
    if (brandType && brandType !== 'All') {
      filter.brandType = brandType;
    }

    // Global Search across brandName, brandId, industry, contactPerson, email, phone, website, and assigned executive
    const search = req.query.search ? String(req.query.search).trim() : '';
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      // Also search assigned employees matching name or email
      const matchingEmployees = await Employee.find({
        $or: [{ name: searchRegex }, { email: searchRegex }],
        isDeleted: { $ne: true }
      }, '_id');
      const matchingEmpIds = matchingEmployees.map(e => e._id);
      let brandIdsFromEmp: any[] = [];
      if (matchingEmpIds.length > 0) {
        const empBrands = await EmployeeBrand.find({ employeeId: { $in: matchingEmpIds }, status: 'Active' });
        brandIdsFromEmp = empBrands.map(eb => eb.brandId);
      }

      const orConditions: any[] = [
        { brandName: searchRegex },
        { brandId: searchRegex },
        { industry: searchRegex },
        { contactPerson: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { website: searchRegex }
      ];

      if (brandIdsFromEmp.length > 0) {
        orConditions.push({ _id: { $in: brandIdsFromEmp } });
      }

      if (filter.$and) {
        filter.$and.push({ $or: orConditions });
      } else if (filter._id) {
        const existingIdFilter = filter._id;
        delete filter._id;
        filter.$and = [{ _id: existingIdFilter }, { $or: orConditions }];
      } else {
        filter.$or = orConditions;
      }
    }

    const totalCount = await Brand.countDocuments(filter);
    const pageNum = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limitNum = req.query.limit ? Math.max(1, Number(req.query.limit)) : 10;

    let query = Brand.find(filter).sort({ createdAt: -1 });
    if (pageNum !== undefined) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }
    const brands = await query;

    // Fetch all active employee assignments to attach assigned executive name to each brand
    const assignments = await EmployeeBrand.find({ status: 'Active' })
      .populate('employeeId', 'name email designation');
    
    const assignmentMap: Record<string, any> = {};
    assignments.forEach((a: any) => {
      if (a.brandId && a.employeeId) {
        assignmentMap[a.brandId.toString()] = a.employeeId;
      }
    });

    const enrichedBrands = brands.map(b => ({
      ...b.toObject(),
      assignedExecutive: assignmentMap[(b._id as any).toString()] || null
    }));

    return res.status(200).json({ 
      success: true, 
      count: enrichedBrands.length, 
      data: enrichedBrands,
      pagination: {
        page: pageNum || 1,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limitNum))
      },
      message: enrichedBrands.length === 0 ? 'No records found' : 'Brands fetched successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching brands', error });
  }
});

// GET /api/v1/brands/:id
router.get('/:id', authenticateToken, checkPermission('brand.view'), async (req: AuthRequest, res: Response) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand || brand.isDeleted) return res.status(404).json({ success: false, message: 'No record exists for this brand' });

    // Fetch assigned employees via relationship collection
    const assignedEmployees = await EmployeeBrand.find({ brandId: brand._id, status: 'Active', isDeleted: { $ne: true } })
      .populate('employeeId', 'name employeeId email designation department phone');

    return res.status(200).json({
      success: true,
      data: {
        ...brand.toObject(),
        assignedEmployees
      },
      message: 'Brand details fetched successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching brand details', error });
  }
});

// POST /api/v1/brands
router.post('/', authenticateToken, checkPermission('brand.create'), async (req: AuthRequest, res: Response) => {
  const { 
    brandName, logo, website, instagramUrl, industry, contactPerson, email, phone, notes,
    brandType = 'Running', targetBarterCollabs, targetPaidCollabs
  } = req.body;

  if (!brandName || !industry) {
    return res.status(400).json({ success: false, message: 'Brand name and industry are required' });
  }

  try {
    const existingBrands = await Brand.find({ brandId: /^BRD-\d+$/ }, { brandId: 1 });
    let maxNum = 100;
    existingBrands.forEach(b => {
      const match = b.brandId?.match(/^BRD-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    let nextNum = maxNum + 1;
    let brandId = `BRD-${nextNum}`;
    while (await Brand.exists({ brandId })) {
      nextNum++;
      brandId = `BRD-${nextNum}`;
    }

    const barterCount = targetBarterCollabs !== undefined ? Number(targetBarterCollabs) : (brandType === 'New' ? 8 : 7);
    const paidCount = targetPaidCollabs !== undefined ? Number(targetPaidCollabs) : (brandType === 'New' ? 2 : 3);
    const totalCount = barterCount + paidCount;

    const brand = await Brand.create({
      brandId,
      brandName,
      logo,
      website,
      instagramUrl,
      industry,
      contactPerson,
      email,
      phone,
      notes,
      brandType,
      targetBarterCollabs: barterCount,
      targetPaidCollabs: paidCount,
      targetTotalCollabs: totalCount,
      status: 'Active'
    });

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action: 'CREATE_BRAND',
      module: 'Brand Management',
      entity: 'Brand',
      entityId: (brand._id as any).toString(),
      newValue: { brandId, brandName, industry, brandType }
    });

    return res.status(200).json({ success: true, message: 'Brand created successfully', data: brand });
  } catch (error: any) {
    console.error('Failed to create brand:', error);
    return res.status(500).json({ 
      success: false, 
      message: error?.message || 'Failed to create brand', 
      error: error?.errmsg || error 
    });
  }
});

// PUT /api/v1/brands/:id
router.put('/:id', authenticateToken, checkPermission('brand.update'), async (req: AuthRequest, res: Response) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: 'No record exists for this brand' });

    const oldValue = { ...brand.toObject() };
    Object.assign(brand, req.body);

    if (req.body.targetBarterCollabs !== undefined || req.body.targetPaidCollabs !== undefined) {
      brand.targetTotalCollabs = (brand.targetBarterCollabs || 0) + (brand.targetPaidCollabs || 0);
    }

    await brand.save();

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action: 'UPDATE_BRAND',
      module: 'Brand Management',
      entity: 'Brand',
      entityId: (brand._id as any).toString(),
      oldValue,
      newValue: brand.toObject()
    });

    return res.status(200).json({ success: true, message: 'Brand updated successfully', data: brand });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update brand', error });
  }
});

// DELETE /api/v1/brands/:id
router.delete('/:id', authenticateToken, checkPermission('brand.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand || brand.isDeleted) return res.status(404).json({ success: false, message: 'No record exists for this brand' });

    brand.isDeleted = true;
    brand.deletedAt = new Date();
    brand.deletedBy = req.user?._id;
    brand.status = 'Inactive';
    await brand.save();

    await EmployeeBrand.updateMany(
      { brandId: req.params.id },
      { status: 'Removed', isDeleted: true, deletedAt: new Date(), deletedBy: req.user?._id }
    );

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action: 'DELETE_BRAND',
      module: 'Brand Management',
      entity: 'Brand',
      entityId: req.params.id,
      oldValue: brand.toObject()
    });

    return res.status(200).json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete brand', error });
  }
});

// POST /api/v1/brands/:id/client-user
router.post('/:id/client-user', authenticateToken, checkPermission('brand.update'), async (req: AuthRequest, res: Response) => {
  const { name, email, password } = req.body;

  if (!email || !name) {
    return res.status(400).json({ success: false, message: 'Client name and email address are required' });
  }

  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });

    let user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      user.role = 'Client';
      user.brandId = brand._id;
      user.status = 'Active';
      user.isApproved = true;
      if (password) {
        user.password = await bcrypt.hash(password, 10);
      }
      await user.save();
    } else {
      const hashedPassword = await bcrypt.hash(password || 'client123', 10);
      user = await User.create({
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'Client',
        brandId: brand._id,
        status: 'Active',
        emailVerified: true,
        isApproved: true
      });
    }

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System',
      action: 'CREATE_CLIENT_USER',
      module: 'Brand Management',
      entity: 'User',
      entityId: (user._id as any).toString(),
      details: `Created/updated Client access for brand ${brand.brandName}`
    });

    return res.status(200).json({
      success: true,
      message: `Client portal access successfully set up for ${email}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        brandId: user.brandId
      }
    });
  } catch (error: any) {
    console.error('Error creating client user:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create client user' });
  }
});

export default router;
