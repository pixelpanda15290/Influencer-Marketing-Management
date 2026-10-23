import mongoose from 'mongoose';
import { Router, Response } from 'express';
import { Employee, Task, EmployeeBrand, Influencer, Brand } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { buildDateFilter } from './targetRoutes';
import { getEmployeeForAuthUser } from '../utils/employeeHelper';
import { isManagerOrAdminRole } from '../config/constants';

const router = Router();

// GET /api/v1/performance
router.get('/', authenticateToken, checkPermission('performance.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { timeframe, year, month, search } = req.query;
    const dateFilter = buildDateFilter(timeframe as string, year as string, month as string);

    let filter: any = { status: 'Active' };

    // Employee Role Isolation: If user is not manager, assistant manager, or admin, only return their own performance data
    const isManagerOrAdmin = isManagerOrAdminRole(req.user?.role);
    if (!isManagerOrAdmin) {
      const emp = await getEmployeeForAuthUser(req.user);
      if (emp) {
        filter._id = emp._id;
      } else {
        filter._id = new mongoose.Types.ObjectId();
      }
    } else if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: searchRegex },
        { employeeId: searchRegex },
        { designation: searchRegex },
        { email: searchRegex }
      ];
    }

    const totalCount = await Employee.countDocuments(filter);
    const pageNum = req.query.page ? Math.max(1, parseInt(req.query.page as string) || 1) : undefined;
    const limitNum = req.query.limit ? Math.max(1, parseInt(req.query.limit as string) || 10) : 10;
    const totalPages = pageNum !== undefined ? (Math.ceil(totalCount / limitNum) || 1) : 1;

    let empQuery = Employee.find(filter).sort({ name: 1 }).lean();
    if (pageNum !== undefined) {
      empQuery = empQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
    }
    const employees = await empQuery;
    const empIds = employees.map(e => e._id);

    // Bulk fetch all assignments and tasks in parallel with .lean()
    const [allAssignments, allTasks, allInfluencerDeals] = await Promise.all([
      EmployeeBrand.find({ employeeId: { $in: empIds }, status: 'Active' }).populate('brandId').lean(),
      Task.find({ employeeId: { $in: empIds } }).lean(),
      Influencer.find(dateFilter.transactionDate ? { transactionDate: dateFilter.transactionDate } : {}).lean()
    ]);

    // Group assignments by employeeId
    const assignmentsByEmp = new Map<string, any[]>();
    for (const a of allAssignments) {
      const eId = a.employeeId?.toString();
      if (eId) {
        if (!assignmentsByEmp.has(eId)) assignmentsByEmp.set(eId, []);
        assignmentsByEmp.get(eId)!.push(a);
      }
    }

    // Group tasks by employeeId
    const tasksByEmp = new Map<string, any[]>();
    for (const t of allTasks) {
      const eId = t.employeeId?.toString();
      if (eId) {
        if (!tasksByEmp.has(eId)) tasksByEmp.set(eId, []);
        tasksByEmp.get(eId)!.push(t);
      }
    }

    const performanceReport = employees.map((emp) => {
      const empIdStr = emp._id.toString();
      const assignments = assignmentsByEmp.get(empIdStr) || [];
      const tasks = tasksByEmp.get(empIdStr) || [];

      const assignedBrandNames = new Set(
        assignments.map((a: any) => a.brandId?.brandName?.toLowerCase()).filter(Boolean)
      );
      const assignedBrandIds = new Set(
        assignments.map((a: any) => a.brandId?._id?.toString()).filter(Boolean)
      );

      const empNameLower = emp.name.trim().toLowerCase();

      // Find deals attributed to this employee
      const deals = allInfluencerDeals.filter(d => {
        const mgr = (d.influencerManager || '').trim().toLowerCase();
        const exec = (d.assignedExecutive || '').trim().toLowerCase();
        const createdByStr = (d.createdBy || '').toString();

        const isMouli = empNameLower.includes('mouli') || empNameLower.includes('maouli');
        const mouliMatch = isMouli && (/mouli|maouli/i.test(mgr) || /mouli|maouli/i.test(exec));

        if (createdByStr === empIdStr || mouliMatch || mgr.includes(empNameLower) || exec.includes(empNameLower)) {
          return true;
        }

        // Check if deal is on an assigned brand with no manager
        const bId = d.brandId ? d.brandId.toString() : '';
        const bName = (d.brandName || '').toLowerCase();
        const isUnassigned = !mgr && !exec;

        if (isUnassigned && (assignedBrandIds.has(bId) || assignedBrandNames.has(bName))) {
          return true;
        }

        return false;
      });

      const barterDeals = deals.filter(d => d.category === 'Barter');
      const paidDeals = deals.filter(d => d.category === 'Paid');

      const barterCount = barterDeals.length;
      const paidCount = paidDeals.length;
      const totalCollabs = deals.length;

      const totalRevenue = paidDeals.reduce((acc, d) => acc + (d.brandOnboardingAmt || d.brandReceivedAmt || 0), 0);
      const totalInfluencerCost = paidDeals.reduce((acc, d) => acc + (d.influencerPaidAmt || d.influencerOnboardingAmt || 0), 0);
      const netMargin = paidDeals.reduce((acc, d) => acc + (d.ad2shipMargin || 0), 0);

      let targetTier = '0%';
      let targetIncentivePercentage = 0;
      let targetIncentiveAmount = 0;

      if (netMargin >= 100000) {
        targetTier = '10%';
        targetIncentivePercentage = 10;
        targetIncentiveAmount = Math.round(netMargin * 0.10);
      } else if (netMargin >= 80000) {
        targetTier = '5%';
        targetIncentivePercentage = 5;
        targetIncentiveAmount = Math.round(netMargin * 0.05);
      }

      const qualifyingBonusDeals = paidDeals.filter(d => (d.ordersGenerated || d.ordersCount || 0) >= 100);
      const orderBonusAmount = qualifyingBonusDeals.reduce((acc, d) => {
        const dealMargin = d.ad2shipMargin || 0;
        return acc + Math.round(dealMargin * 0.10);
      }, 0);

      const totalTakeHomeIncentive = targetIncentiveAmount + orderBonusAmount;
      const individualMonthlyTarget = 120000;
      const targetAchievedPercent = individualMonthlyTarget > 0 ? Math.min(100, Math.round((netMargin / individualMonthlyTarget) * 100)) : 0;

      // Task Metrics
      const totalAssigned = tasks.length;
      const completed = tasks.filter(t => t.status === 'Verified' || t.status === 'Submitted').length;
      const pending = tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
      const delayed = tasks.filter(t => t.status === 'Delayed').length;
      const missed = tasks.filter(t => t.status === 'Missed' || t.status === 'Rejected').length;
      const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;
      const onTimeCount = tasks.filter(t => 
        (t.status === 'Verified' || t.status === 'Submitted') && 
        t.publishedDate && t.deadline && new Date(t.publishedDate) <= new Date(t.deadline)
      ).length;
      const onTimeRate = completed > 0 ? Math.round((onTimeCount / completed) * 100) : (totalAssigned > 0 ? 100 : 0);

      return {
        employee: {
          id: emp._id,
          employeeId: emp.employeeId,
          name: emp.name,
          email: emp.email,
          department: emp.department,
          designation: emp.designation,
          role: emp.role
        },
        incentiveSummary: {
          netMargin,
          individualMonthlyTarget,
          targetAchievedPercent,
          targetTier,
          targetIncentivePercentage,
          targetIncentiveAmount,
          qualifyingBonusDealsCount: qualifyingBonusDeals.length,
          orderBonusAmount,
          totalTakeHomeIncentive,
          totalRevenue,
          totalInfluencerCost,
          barterCount,
          paidCount,
          totalCollabs
        },
        qualifyingDeals: qualifyingBonusDeals.map(d => ({
          id: d._id,
          brandName: d.brandName,
          influencerName: d.influencerName,
          ordersGenerated: d.ordersGenerated || d.ordersCount || 0,
          ad2shipMargin: d.ad2shipMargin,
          bonusEarned: Math.round((d.ad2shipMargin || 0) * 0.10)
        })),
        metrics: {
          totalAssigned,
          completed,
          pending,
          delayed,
          missed,
          completionRate,
          onTimeRate,
          brandsManaged: assignments.length
        }
      };
    });

    return res.status(200).json({ 
      success: true, 
      count: performanceReport.length,
      total: totalCount,
      page: pageNum || 1,
      totalPages,
      limit: limitNum,
      data: performanceReport,
      message: totalCount === 0 ? 'No records found' : 'Performance report fetched successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to calculate performance metrics', error });
  }
});

// GET /api/v1/performance/:employeeId
router.get('/:employeeId', authenticateToken, checkPermission('performance.view'), async (req: AuthRequest, res: Response) => {
  try {
    const isManagerOrAdmin = isManagerOrAdminRole(req.user?.role);
    if (!isManagerOrAdmin) {
      const currentEmp = await getEmployeeForAuthUser(req.user);
      if (!currentEmp || currentEmp._id.toString() !== req.params.employeeId) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only view your own performance' });
      }
    }

    const emp = await Employee.findById(req.params.employeeId);
    if (!emp) return res.status(404).json({ success: false, message: 'No record exists for this employee' });

    const tasks = await Task.find({ employeeId: emp._id }).populate('brandId', 'brandName');
    const totalAssigned = tasks.length;
    const completed = tasks.filter(t => t.status === 'Verified' || t.status === 'Submitted').length;
    const pending = tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
    const delayed = tasks.filter(t => t.status === 'Delayed').length;
    const missed = tasks.filter(t => t.status === 'Missed' || t.status === 'Rejected').length;

    const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;
    const brands = await EmployeeBrand.find({ employeeId: emp._id, status: 'Active' }).populate('brandId');

    return res.status(200).json({
      success: true,
      message: 'Employee performance data fetched successfully',
      data: {
        employee: emp,
        metrics: {
          totalAssigned,
          completed,
          pending,
          delayed,
          missed,
          completionRate
        },
        brands,
        tasks
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching employee performance', error });
  }
});

export default router;
