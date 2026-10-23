import mongoose from 'mongoose';
import { Router, Response } from 'express';
import { Employee, Brand, Task, EmployeeBrand } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { getEmployeeForAuthUser } from '../utils/employeeHelper';
import { isManagerOrAdminRole } from '../config/constants';

const router = Router();

// GET /api/v1/reports/employee-summary
router.get('/employee-summary', authenticateToken, checkPermission('report.view'), async (req: AuthRequest, res: Response) => {
  try {
    const isManagerOrAdmin = isManagerOrAdminRole(req.user?.role);
    let empQuery: any = {};
    if (!isManagerOrAdmin) {
      const currentEmp = await getEmployeeForAuthUser(req.user);
      if (currentEmp) {
        empQuery._id = currentEmp._id;
      } else {
        empQuery._id = new mongoose.Types.ObjectId();
      }
    }

    const employees = await Employee.find(empQuery).sort({ name: 1 });

    const report = await Promise.all(
      employees.map(async (emp) => {
        const assignedBrands = await EmployeeBrand.countDocuments({ employeeId: emp._id, status: 'Active' });
        const tasks = await Task.find({ employeeId: emp._id });

        const totalTasks = tasks.length;
        const completed = tasks.filter(t => t.status === 'Verified' || t.status === 'Submitted').length;
        const pending = tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
        const delayed = tasks.filter(t => t.status === 'Delayed').length;
        const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

        return {
          employeeId: emp.employeeId,
          name: emp.name,
          department: emp.department,
          designation: emp.designation,
          assignedBrands,
          totalTasks,
          completed,
          pending,
          delayed,
          completionRate: `${completionRate}%`
        };
      })
    );

    return res.status(200).json({ 
      success: true, 
      count: report.length, 
      data: report,
      message: report.length === 0 ? 'No records found' : 'Employee summary report generated successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate employee report', error });
  }
});

// GET /api/v1/reports/brand-summary
router.get('/brand-summary', authenticateToken, checkPermission('report.view'), async (req: AuthRequest, res: Response) => {
  try {
    const isManagerOrAdmin = isManagerOrAdminRole(req.user?.role);
    let brandQuery: any = {};
    if (!isManagerOrAdmin) {
      const currentEmp = await getEmployeeForAuthUser(req.user);
      if (currentEmp) {
        const assignments = await EmployeeBrand.find({ employeeId: currentEmp._id, status: 'Active' });
        const assignedBrandIds = assignments.map(a => a.brandId);
        brandQuery._id = { $in: assignedBrandIds };
      } else {
        brandQuery._id = { $in: [] };
      }
    }

    const brands = await Brand.find(brandQuery).sort({ brandName: 1 });

    const report = await Promise.all(
      brands.map(async (b) => {
        const assignedEmployees = await EmployeeBrand.countDocuments({ brandId: b._id, status: 'Active' });
        const tasks = await Task.find({ brandId: b._id });

        const totalTasks = tasks.length;
        const completed = tasks.filter(t => t.status === 'Verified' || t.status === 'Submitted').length;
        const pending = tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
        const delayed = tasks.filter(t => t.status === 'Delayed').length;

        return {
          brandId: b.brandId,
          brandName: b.brandName,
          industry: b.industry,
          assignedEmployees,
          totalTasks,
          completed,
          pending,
          delayed
        };
      })
    );

    return res.status(200).json({ 
      success: true, 
      count: report.length, 
      data: report,
      message: report.length === 0 ? 'No records found' : 'Brand summary report generated successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate brand report', error });
  }
});

// GET /api/v1/reports/daily-posting
router.get('/daily-posting', authenticateToken, checkPermission('report.view'), async (req: AuthRequest, res: Response) => {
  const { date } = req.query;
  const targetDate = date ? new Date(date as string) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const isManagerOrAdmin = isManagerOrAdminRole(req.user?.role);
    let taskFilter: any = { scheduledDate: { $gte: startOfDay, $lte: endOfDay } };
    if (!isManagerOrAdmin) {
      const currentEmp = await getEmployeeForAuthUser(req.user);
      if (currentEmp) {
        const assignments = await EmployeeBrand.find({ employeeId: currentEmp._id, status: 'Active' });
        const assignedBrandIds = assignments.map(a => a.brandId);
        taskFilter.$or = [
          { employeeId: currentEmp._id },
          { brandId: { $in: assignedBrandIds } }
        ];
      } else {
        taskFilter.employeeId = new mongoose.Types.ObjectId();
      }
    }

    const tasks = await Task.find(taskFilter)
      .populate('employeeId', 'name employeeId')
      .populate('brandId', 'brandName')
      .sort({ scheduledTime: 1 });

    const report = tasks.map(t => {
      const emp = t.employeeId as any;
      const brand = t.brandId as any;
      return {
        taskId: t.taskId,
        scheduledDate: t.scheduledDate.toISOString().split('T')[0],
        scheduledTime: t.scheduledTime,
        employee: emp ? emp.name : 'Unassigned',
        brand: brand ? brand.brandName : 'N/A',
        platform: t.platform,
        contentType: t.contentType,
        taskTitle: t.title,
        status: t.status,
        publishedUrl: t.publishedUrl || 'N/A',
        verificationStatus: t.verificationStatus
      };
    });

    return res.status(200).json({ 
      success: true, 
      date: startOfDay.toISOString().split('T')[0], 
      count: report.length, 
      data: report,
      message: report.length === 0 ? 'No records found' : 'Daily posting report generated successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate daily posting report', error });
  }
});

export default router;
