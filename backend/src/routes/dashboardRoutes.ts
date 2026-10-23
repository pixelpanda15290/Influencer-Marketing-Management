import { Router, Response } from 'express';
import { User, Employee, Brand, Task, EmployeeBrand, AuditLog, Target } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { cacheMiddleware } from '../middleware/cache';
import { recalculateTargetProgress } from './targetRoutes';
import { getEmployeeForAuthUser } from '../utils/employeeHelper';
import { isManagerOrAdminRole } from '../config/constants';

const router = Router();

// GET /api/v1/dashboard/stats
router.get('/stats', authenticateToken, cacheMiddleware(30), async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const role = req.user.role;
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  try {
    if (!isManagerOrAdminRole(role)) {
      const emp = await getEmployeeForAuthUser(req.user);
      if (!emp) {
        return res.status(404).json({ success: false, message: 'No record exists for employee profile' });
      }

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      // Run all queries concurrently for ultra-fast response
      const [myBrands, todaysTasksInitial, upcomingTasks, activeTargetFound] = await Promise.all([
        EmployeeBrand.find({ employeeId: emp._id, status: 'Active' })
          .populate('brandId', 'brandName brandId logo industry')
          .lean(),
        Task.find({
          employeeId: emp._id,
          scheduledDate: { $gte: startOfDay, $lte: endOfDay }
        }).populate('brandId', 'brandName logo').sort({ scheduledTime: 1 }).lean(),
        Task.find({
          employeeId: emp._id,
          scheduledDate: { $gt: endOfDay, $lte: nextWeek }
        }).populate('brandId', 'brandName logo').limit(10).sort({ scheduledDate: 1 }).lean(),
        Target.findOne({ isActive: true, status: 'Active' }).sort({ updatedAt: -1 })
      ]);

      let activeTarget = activeTargetFound;
      if (!activeTarget) {
        activeTarget = await Target.findOne({ status: 'Active' }).sort({ createdAt: -1 });
      }
      if (activeTarget) {
        await recalculateTargetProgress(activeTarget);
      }

      let todaysTasks = todaysTasksInitial;
      if (todaysTasks.length === 0) {
        todaysTasks = await Task.find({ employeeId: emp._id })
          .populate('brandId', 'brandName logo')
          .sort({ createdAt: -1 })
          .limit(6)
          .lean();
      }

      const completedCount = todaysTasks.filter((t: any) => t.status === 'Verified' || t.status === 'Submitted').length;
      const pendingCount = todaysTasks.filter((t: any) => t.status === 'Pending' || t.status === 'In Progress').length;
      const delayedCount = todaysTasks.filter((t: any) => t.status === 'Delayed').length;

      return res.status(200).json({
        success: true,
        role: 'Employee',
        message: 'Dashboard stats fetched successfully',
        data: {
          myBrands,
          todaySummary: {
            total: todaysTasks.length,
            completed: completedCount,
            pending: pendingCount,
            delayed: delayedCount
          },
          todaysTasks,
          upcomingTasks,
          activeTarget
        }
      });
    }

    // Manager / Super Admin / Admin Dashboard — Parallel Queries
    const [totalEmployees, totalBrands, todaysTasksInitial, upcomingPostings, recentAuditLogs, activeTargetFound] = await Promise.all([
      Employee.countDocuments({ status: 'Active' }),
      Brand.countDocuments({ status: 'Active' }),
      Task.find({
        scheduledDate: { $gte: startOfDay, $lte: endOfDay }
      }).populate('employeeId', 'name designation').populate('brandId', 'brandName logo').lean(),
      Task.find({
        scheduledDate: { $gt: endOfDay }
      }).populate('employeeId', 'name').populate('brandId', 'brandName logo').sort({ scheduledDate: 1 }).limit(5).lean(),
      AuditLog.find().sort({ timestamp: -1 }).limit(8).lean(),
      Target.findOne({ isActive: true, status: 'Active' }).sort({ updatedAt: -1 })
    ]);

    let activeTarget = activeTargetFound;
    if (!activeTarget) {
      activeTarget = await Target.findOne({ status: 'Active' }).sort({ createdAt: -1 });
    }
    if (activeTarget) {
      await recalculateTargetProgress(activeTarget);
    }

    let todaysTasks = todaysTasksInitial;
    if (todaysTasks.length === 0) {
      todaysTasks = await Task.find({ status: { $in: ['Pending', 'Submitted', 'Verified'] } })
        .populate('employeeId', 'name designation')
        .populate('brandId', 'brandName logo')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();
    }

    const completed = todaysTasks.filter(t => t.status === 'Verified' || t.status === 'Submitted').length;
    const pending = todaysTasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
    const delayed = todaysTasks.filter(t => t.status === 'Delayed').length;

    return res.status(200).json({
      success: true,
      role,
      message: 'Dashboard stats fetched successfully',
      data: {
        totalEmployees,
        totalBrands,
        todaySummary: {
          total: todaysTasks.length,
          completed,
          pending,
          delayed
        },
        todaysTasks,
        upcomingPostings,
        recentAuditLogs,
        activeTarget
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard data', error });
  }
});

export default router;
