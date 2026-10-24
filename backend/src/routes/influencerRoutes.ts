import { Router, Response } from 'express';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import { Influencer, Brand, PaymentLog, Employee, EmployeeBrand, Target, InfluencerDirectory, User } from '../models/allModels';
import { authenticateToken, authenticateOrApiKey, AuthRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { logActivity } from '../middleware/auditLog';
import { getEmployeeForAuthUser } from '../utils/employeeHelper';

const router = Router();

// Helper to sanitize Instagram handle & profile URL
const cleanInstagramHandleAndLink = (inputHandle?: string, inputLink?: string) => {
  let raw = (inputHandle || '').trim();
  if (!raw) return { name: '', handle: '', link: '' };

  const lower = raw.toLowerCase();

  // If raw is a non-instagram website URL (e.g. product link, shopify link, website), keep it completely blank
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('www.') || lower.startsWith('@http')) {
    if (!lower.includes('instagram.com/')) {
      return { name: '', handle: '', link: '' };
    }
  }

  // If raw contains domain extensions or web paths without being Instagram
  if (lower.includes('.com') || lower.includes('.in') || lower.includes('.co') || lower.includes('.store') || lower.includes('.shop') || lower.includes('.org') || lower.includes('.net')) {
    if (!lower.includes('instagram.com/')) {
      return { name: '', handle: '', link: '' };
    }
  }

  // If it's a full Instagram URL e.g. https://www.instagram.com/jaipurfame_creator/?igsh=...
  if (lower.includes('instagram.com/')) {
    const cleanUrl = raw.split('?')[0].split('#')[0];
    const parts = cleanUrl.split('/').filter(Boolean);
    const handleCandidate = parts.pop() || '';
    if (handleCandidate && handleCandidate !== 'instagram.com' && handleCandidate !== 'www.instagram.com' && handleCandidate !== 'reel' && handleCandidate !== 'p' && handleCandidate !== 'reels') {
      const cleanHandle = handleCandidate.replace(/^@/, '').replace(/\s+/g, '').trim();
      return {
        name: cleanHandle,
        handle: `@${cleanHandle}`,
        link: `https://instagram.com/${cleanHandle}`
      };
    }
    return { name: '', handle: '', link: '' };
  }

  // If raw string has slashes
  if (raw.includes('/')) {
    return { name: '', handle: '', link: '' };
  }

  // Clean normal name / handle
  const clean = raw.replace(/\s*\((Barter|Paid)\)\s*/gi, '').trim();
  if (!clean) return { name: '', handle: '', link: '' };

  const cleanHandle = clean.replace(/^@/, '').replace(/\s+/g, '').trim();
  if (cleanHandle.length > 0 && cleanHandle.length < 50) {
    return {
      name: clean.startsWith('@') ? cleanHandle : clean,
      handle: `@${cleanHandle}`,
      link: `https://instagram.com/${cleanHandle}`
    };
  }

  return { name: '', handle: '', link: '' };
};

// Helper to keep active targets in sync with transactions
const triggerTargetSync = async () => {
  try {
    const targets = await Target.find({ status: 'Active', autoSync: true, isDeleted: { $ne: true } });
    for (const target of targets) {
      const now = new Date();
      const startDate = target.startDate || new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const endDate = target.endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      if (target.targetType === 'Barter') {
        const count = await Influencer.countDocuments({
          category: 'Barter',
          isDeleted: { $ne: true },
          status: { $in: ['Completed', 'Approved', 'Settled', 'completed', 'approved', 'settled'] },
          transactionDate: { $gte: startDate, $lte: endDate }
        });
        target.achievedCount = count;
        target.achievedAmount = count;
      } else {
        const paidRecords = await Influencer.find({
          category: 'Paid',
          isDeleted: { $ne: true },
          status: { $in: ['Completed', 'Approved', 'Settled', 'completed', 'approved', 'settled'] },
          transactionDate: { $gte: startDate, $lte: endDate }
        });
        target.achievedAmount = paidRecords.reduce((acc, curr) => acc + (curr.ad2shipMargin || 0), 0);
      }
      await target.save();
    }
  } catch (err) {
    console.error('Target sync error:', err);
  }
};

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getCanonicalManagerName = (name?: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === 'mouli' ||
    lower === 'mouli pandey' ||
    lower === 'maouli' ||
    lower === 'maouli pandey'
  ) {
    return 'Mouli Pandey';
  }
  if (lower === 'harsh' || lower === 'harsh jonwal') {
    return 'Harsh Jonwal';
  }
  if (lower === 'pp') {
    return 'PP';
  }
  if (lower === 'yash') {
    return 'Yash';
  }
  return trimmed;
};

export const getManagerSearchRegex = (name: string): RegExp => {
  const lower = name.trim().toLowerCase();
  if (
    lower === 'mouli' ||
    lower === 'mouli pandey' ||
    lower === 'maouli' ||
    lower === 'maouli pandey'
  ) {
    return /^(mouli|maouli)( pandey)?$/i;
  }
  if (lower === 'harsh' || lower === 'harsh jonwal') {
    return /^harsh( jonwal)?$/i;
  }
  return new RegExp(`^${escapeRegex(name.trim())}$`, 'i');
};

// GET /api/v1/influencers
router.get('/', authenticateToken, checkPermission('influencer.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { category, timeframe, year, month, search, brand, manager, status, deliverable, date, startDate, endDate, completedStartDate, completedEndDate } = req.query;
    const filter: any = { isDeleted: { $ne: true } };

    // 0. Employee / Executive Role Scoping:
    // Show all previous and current collaborations for brands assigned to this executive,
    // plus any collaborations where the executive is directly the manager, assignee, or creator.
    const userRole = req.user?.role;
    const isExecutive = userRole === 'Employee' || userRole === 'Posting & Content Executive' || userRole === 'Barter Collab Executive' || userRole === 'Paid Collab Executive';
    let executiveScopingOr: any[] | null = null;

    if (isExecutive && req.user) {
      const employeeDoc = await getEmployeeForAuthUser(req.user);
      if (employeeDoc) {
        const empNameRegex = getManagerSearchRegex(employeeDoc.name);

        // Fetch active brand assignments for this employee
        const assignmentQuery: any = {
          employeeId: employeeDoc._id,
          status: 'Active'
        };
        if (userRole === 'Barter Collab Executive') {
          assignmentQuery.assignmentType = { $in: [2, null] };
        } else if (userRole === 'Paid Collab Executive') {
          assignmentQuery.assignmentType = { $in: [3, null] };
        }

        const assignments = await EmployeeBrand.find(assignmentQuery).lean();
        const assignedBrandIds = assignments.map(a => a.brandId);

        // Fetch brand documents to match both brandId and brandName (case-insensitive)
        const assignedBrands = await Brand.find({ _id: { $in: assignedBrandIds } }).select('brandName').lean();
        const brandNames = assignedBrands.map(b => b.brandName).filter(Boolean);
        const brandNameRegexes = brandNames.map(name => new RegExp(`^${escapeRegex(name.trim())}$`, 'i'));

        executiveScopingOr = [
          { influencerManager: empNameRegex },
          { assignedExecutive: empNameRegex },
          { createdBy: req.user._id }
        ];

        if (assignedBrandIds.length > 0) {
          executiveScopingOr.push({ brandId: { $in: assignedBrandIds } });
        }
        if (brandNameRegexes.length > 0) {
          executiveScopingOr.push({ brandName: { $in: brandNameRegexes } });
        }

        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: executiveScopingOr
        });
      }
    }

    // 1. Sub-module Category Filter (Paid vs Barter)
    if (category && category !== 'All') {
      filter.category = category;
    } else if (userRole === 'Barter Collab Executive') {
      filter.category = 'Barter';
    } else if (userRole === 'Paid Collab Executive') {
      filter.category = 'Paid';
    }

    // 2. Date Range / Timeframe Filter — Matches transactionDate OR connectedDate/createdAt if transactionDate is blank
    const now = new Date();
    const currentYear = Number(year) || now.getFullYear();
    const currentMonth = month !== undefined ? Number(month) - 1 : now.getMonth();

    const getDateQuery = (start: Date, end: Date) => ({
      $or: [
        // 1. Primary: connectedDate
        { connectedDate: { $gte: start, $lte: end } },
        // 2. Fallback: transactionDate (only if connectedDate is not present)
        {
          $and: [
            { $or: [{ connectedDate: { $exists: false } }, { connectedDate: null }] },
            { transactionDate: { $gte: start, $lte: end } }
          ]
        },
        // 3. Fallback: createdAt (only if both connectedDate and transactionDate are not present)
        {
          $and: [
            { $or: [{ connectedDate: { $exists: false } }, { connectedDate: null }] },
            { $or: [{ transactionDate: { $exists: false } }, { transactionDate: null }] },
            { createdAt: { $gte: start, $lte: end } }
          ]
        }
      ]
    });

    const isCompletedFilterActive = !!(
      (completedStartDate && typeof completedStartDate === 'string' && completedStartDate.trim()) ||
      (completedEndDate && typeof completedEndDate === 'string' && completedEndDate.trim())
    );

    if (isCompletedFilterActive) {
      // User is querying by Completed At date range:
      // "show all colab that completed on that completed at date range, whether created in that range or earlier"
      const compStatusFilter = { $in: ['Completed', 'Approved', 'Settled', 'completed', 'approved', 'settled'] };
      const startComp = completedStartDate ? new Date(String(completedStartDate)) : undefined;
      const endComp = completedEndDate ? new Date(String(completedEndDate)) : undefined;
      if (endComp) endComp.setHours(23, 59, 59, 999);

      filter.$and = filter.$and || [];
      const completedCondition: any = {
        status: compStatusFilter
      };

      if (startComp && endComp) {
        completedCondition.$or = [
          { completedAt: { $gte: startComp, $lte: endComp } },
          {
            $and: [
              { $or: [{ completedAt: { $exists: false } }, { completedAt: null }] },
              { updatedAt: { $gte: startComp, $lte: endComp } }
            ]
          }
        ];
      } else if (startComp) {
        completedCondition.$or = [
          { completedAt: { $gte: startComp } },
          {
            $and: [
              { $or: [{ completedAt: { $exists: false } }, { completedAt: null }] },
              { updatedAt: { $gte: startComp } }
            ]
          }
        ];
      } else if (endComp) {
        completedCondition.$or = [
          { completedAt: { $lte: endComp } },
          {
            $and: [
              { $or: [{ completedAt: { $exists: false } }, { completedAt: null }] },
              { updatedAt: { $lte: endComp } }
            ]
          }
        ];
      }
      filter.$and.push(completedCondition);
    } else {
      // 2a. Priority 1: Explicit Date Range (startDate & endDate)
      if (startDate && typeof startDate === 'string' && startDate.trim()) {
        const parsedStart = new Date(startDate);
        const endCandidate = (endDate && typeof endDate === 'string' && endDate.trim()) ? endDate : startDate;
        const parsedEnd = new Date(endCandidate);
        if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
          const startOfDay = new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate(), 0, 0, 0);
          const endOfDay = new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate(), 23, 59, 59);
          filter.$and = filter.$and || [];
          filter.$and.push(getDateQuery(startOfDay, endOfDay));
        }
      } else if (date && typeof date === 'string' && date.trim()) {
        // 2b. Exact Single Date
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          const startOfDay = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0);
          const endOfDay = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 23, 59, 59);
          filter.$and = filter.$and || [];
          filter.$and.push(getDateQuery(startOfDay, endOfDay));
        }
      } else if (timeframe && (timeframe as string).includes('_')) {
        const parts = (timeframe as string).split('_');
        const monthNames: Record<string, number> = {
          january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
          july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
        };
        const mIdx = monthNames[parts[0].toLowerCase()];
        const yr = Number(parts[1]) || 2026;
        if (mIdx !== undefined) {
          const startOfMonth = new Date(yr, mIdx, 1, 0, 0, 0);
          const endOfMonth = new Date(yr, mIdx + 1, 0, 23, 59, 59);
          filter.$and = filter.$and || [];
          filter.$and.push(getDateQuery(startOfMonth, endOfMonth));
        }
      } else if (timeframe === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        filter.$and = filter.$and || [];
        filter.$and.push(getDateQuery(startOfDay, endOfDay));
      } else if (timeframe === 'monthly' || timeframe === 'Month') {
        const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0);
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
        filter.$and = filter.$and || [];
        filter.$and.push(getDateQuery(startOfMonth, endOfMonth));
      } else if (timeframe === 'yearly' || timeframe === 'Year') {
        const startOfYear = new Date(currentYear, 0, 1, 0, 0, 0);
        const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);
        filter.$and = filter.$and || [];
        filter.$and.push(getDateQuery(startOfYear, endOfYear));
      }
    }

    // Global Tab Counts for this timeframe / scope (stable across tab switches & table filters)
    const timeScopedBase: any = { isDeleted: { $ne: true } };
    if (filter.$and && filter.$and.length > 0) {
      timeScopedBase.$and = [...filter.$and];
    }

    // 3. Search Filter
    if (search && typeof search === 'string' && search.trim()) {
      const sRegex = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [
        { influencerName: sRegex },
        { brandName: sRegex },
        { influencerManager: sRegex },
        { phone: sRegex },
        { notes: sRegex }
      ];
    }

    // 4. Specific Dropdown Filters from Database
    if (brand && typeof brand === 'string' && brand.trim()) {
      filter.brandName = new RegExp(`^${escapeRegex(brand.trim())}$`, 'i');
    }

    if (manager && typeof manager === 'string' && manager.trim()) {
      if (manager === '__UNASSIGNED__') {
        filter.$or = [
          { influencerManager: { $exists: false } },
          { influencerManager: null },
          { influencerManager: '' }
        ];
      } else {
        const mgrRegex = getManagerSearchRegex(manager);
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { influencerManager: mgrRegex },
            { assignedExecutive: mgrRegex }
          ]
        });
      }
    }

    if (status && typeof status === 'string' && status.trim()) {
      filter.status = new RegExp(`^${escapeRegex(status.trim())}$`, 'i');
    }

    if (deliverable && typeof deliverable === 'string' && deliverable.trim()) {
      filter.videoType = new RegExp(`^${escapeRegex(deliverable.trim())}$`, 'i');
    }

    const isAll = req.query.page === 'all' || req.query.limit === 'all' || !req.query.page;
    const pageNum = (!isAll && req.query.page) ? Math.max(1, Number(req.query.page)) : undefined;
    const limitNum = (!isAll && req.query.limit) ? Math.max(1, Number(req.query.limit)) : undefined;

    // Fetch dynamic distinct filter options from database for this category & timeframe scope
    const baseCategoryFilter: any = { isDeleted: { $ne: true } };
    if (category && category !== 'All') {
      baseCategoryFilter.category = category;
    } else if (userRole === 'Barter Collab Executive') {
      baseCategoryFilter.category = 'Barter';
    } else if (userRole === 'Paid Collab Executive') {
      baseCategoryFilter.category = 'Paid';
    }
    if (executiveScopingOr && executiveScopingOr.length > 0) {
      baseCategoryFilter.$or = executiveScopingOr;
    }

    const monthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    const [allDistinctBrands, allDistinctManagers, allDistinctStatuses, allDistinctDeliverables, allMatching, paidCount, barterCount, allCount, completedMonthDocs] = await Promise.all([
      Influencer.distinct('brandName', baseCategoryFilter),
      Influencer.distinct('influencerManager', baseCategoryFilter),
      Influencer.distinct('status', baseCategoryFilter),
      Influencer.distinct('videoType', baseCategoryFilter),
      Influencer.find(filter).select('inAmount outAmount'),
      Influencer.countDocuments({ ...timeScopedBase, category: 'Paid' }),
      Influencer.countDocuments({ ...timeScopedBase, category: 'Barter' }),
      Influencer.countDocuments(timeScopedBase),
      Influencer.find({
        isDeleted: { $ne: true },
        ...(category && category !== 'All' ? { category } : {}),
        status: { $in: ['Completed', 'Approved', 'Settled', 'completed', 'approved', 'settled'] },
        $or: [
          { completedAt: { $gte: monthStart, $lte: monthEnd } },
          {
            $and: [
              { $or: [{ completedAt: { $exists: false } }, { completedAt: null }] },
              { updatedAt: { $gte: monthStart, $lte: monthEnd } }
            ]
          }
        ]
      }).select('completedAt updatedAt').lean()
    ]);

    const distinctCompletedDates = Array.from(new Set(
      (completedMonthDocs || []).map((d: any) => {
        const raw = d.completedAt || d.updatedAt;
        if (!raw) return '';
        const dt = new Date(raw);
        if (isNaN(dt.getTime())) return '';
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }).filter(Boolean)
    )).sort();

    const totalIn = allMatching.reduce((acc, curr) => acc + (curr.inAmount || 0), 0);
    const totalOut = allMatching.reduce((acc, curr) => acc + (curr.outAmount || 0), 0);
    const netBalance = totalIn - totalOut;
    const totalCount = allMatching.length;

    let query = Influencer.find(filter)
      .populate('brandId', 'brandName brandId logo')
      .sort(isCompletedFilterActive ? { updatedAt: -1, completedAt: -1, sNo: 1 } : { connectedDate: 1, transactionDate: 1, orderDate: 1, sNo: 1 });

    if (pageNum !== undefined && limitNum !== undefined) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const rawInfluencers = await query;
    const influencers = rawInfluencers.map((doc: any) => {
      const item = doc.toObject ? doc.toObject() : { ...doc };
      // Fallback for previous records: If completedAt is missing and status is Completed/Approved/Settled, use updatedAt
      if (!item.completedAt && (item.status === 'Completed' || item.status === 'Approved' || item.status === 'Settled')) {
        item.completedAt = item.updatedAt || item.createdAt;
      }
      if (!item.statusUpdatedAt) {
        item.statusUpdatedAt = item.updatedAt || item.createdAt;
      }
      if (!item.parcelSentAt && item.status === 'Parcel Sent') {
        item.parcelSentAt = item.updatedAt || item.createdAt;
      }
      if (!item.underReviewAt && item.status === 'Under Review') {
        item.underReviewAt = item.updatedAt || item.createdAt;
      }
      if (!item.inDiscussionAt && item.status === 'In Discussion') {
        item.inDiscussionAt = item.updatedAt || item.createdAt;
      }
      if (!item.productReturnedAt && item.status === 'Product Returned') {
        item.productReturnedAt = item.updatedAt || item.createdAt;
      }

      // Compute Escalation for Parcel Sent > 7 days (starts on 8th day) without video
      const sentDate = item.parcelSentAt || (item.status === 'Parcel Sent' ? (item.statusUpdatedAt || item.orderDate || item.updatedAt) : null);
      if (item.status === 'Parcel Sent' && sentDate && !item.contentLink) {
        const d = new Date(sentDate);
        if (!isNaN(d.getTime())) {
          const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
          item.daysSinceParcelSent = Math.max(0, diffDays) + 1; // Day 1, Day 2...
          item.isEscalated = item.daysSinceParcelSent >= 8;
        } else {
          item.isEscalated = false;
          item.daysSinceParcelSent = 0;
        }
      } else {
        item.isEscalated = false;
        item.daysSinceParcelSent = 0;
      }

      return item;
    });

    const escalatedCount = influencers.filter((i: any) => i.isEscalated).length;

    return res.status(200).json({
      success: true,
      timeframe: timeframe || 'all',
      metrics: {
        totalIn,
        totalOut,
        netBalance,
        totalCount,
        escalatedCount,
        barterReceivedCount: influencers.filter((i: any) => i.category === 'Barter' && (i.status === 'Completed' || i.status === 'Approved' || i.status === 'Settled')).length
      },
      tabCounts: {
        paid: paidCount,
        barter: barterCount,
        all: allCount
      },
      filterOptions: {
        brands: (allDistinctBrands as string[]).filter(Boolean).map(s => s.trim()).filter((v, i, a) => a.indexOf(v) === i).sort(),
        managers: Array.from(new Set((allDistinctManagers as string[]).filter(Boolean).map(s => getCanonicalManagerName(s.trim())))).filter(Boolean).sort(),
        statuses: (allDistinctStatuses as string[]).filter(Boolean).map(s => s.trim()).filter((v, i, a) => a.indexOf(v) === i).sort(),
        deliverables: (allDistinctDeliverables as string[]).filter(Boolean).map(s => s.trim()).filter((v, i, a) => a.indexOf(v) === i).sort(),
        completedDates: distinctCompletedDates
      },
      pagination: {
        page: pageNum || 1,
        limit: limitNum || totalCount,
        total: totalCount,
        totalPages: limitNum ? Math.max(1, Math.ceil(totalCount / limitNum)) : 1
      },
      data: influencers,
      message: influencers.length === 0 ? 'No records found' : 'Influencer records fetched successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching influencer records', error });
  }
});

// POST /api/v1/influencers
router.post('/', authenticateToken, checkPermission('influencer.create'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      influencerName, influencerManager, brandManagerTeam, brandId, brandName, phone, profileLink, influencerInstagramId, category,
      brandOnboardingAmt, brandReceivedAmt, influencerOnboardingAmt, influencerPaidAmt, finalPaymentReceived,
      inAmount, outAmount, productLink, videoType, videoDescription, refVideoLink, referenceVideoLink, orderId, orderDate,
      platform, status, contentLink, adsCode, viewsCount, ordersCount, ordersGenerated, isApproved, approvalStatus, reason, notes, remark, remarks, transactionDate, connectedDate
    } = req.body;

    let finalBrandName = brandName;
    if (brandId && !finalBrandName) {
      const b = await Brand.findById(brandId);
      if (b) finalBrandName = b.brandName;
    }

    // Auto-calculate Google Sheet financial breakdown fields
    const bOnboard = Number(brandOnboardingAmt) || Number(inAmount) || 0;
    const bRecv = Number(brandReceivedAmt) !== undefined ? Number(brandReceivedAmt) : bOnboard;
    const bPend = bOnboard - bRecv;

    const infOnboard = Number(influencerOnboardingAmt) || Number(outAmount) || 0;
    const infPaid = Number(influencerPaidAmt) !== undefined ? Number(influencerPaidAmt) : infOnboard;
    const infPend = infOnboard - infPaid;

    const ad2shipMargin = bOnboard - infOnboard;
    const inAmt = bRecv;
    const outAmt = infPaid;
    const balance = inAmt - outAmt;

    const actualOrders = Number(ordersGenerated !== undefined ? ordersGenerated : ordersCount) || 0;
    const isOrderBonusQualified = (category === 'Paid' || !category) && actualOrders >= 100;

    const count = await Influencer.countDocuments();
    const targetStatus = status || 'Pending';
    const finalRefLink = refVideoLink || referenceVideoLink || '';
    const finalInstaId = influencerInstagramId || profileLink || '';

    const now = new Date();
    let completedAtVal: Date | undefined = req.body.completedAt ? new Date(req.body.completedAt) : undefined;
    let parcelSentAtVal: Date | undefined = undefined;
    let underReviewAtVal: Date | undefined = undefined;
    let inDiscussionAtVal: Date | undefined = undefined;
    let productReturnedAtVal: Date | undefined = undefined;
    if (targetStatus === 'Completed' || targetStatus === 'Approved' || targetStatus === 'Settled') {
      if (!completedAtVal) completedAtVal = now;
    } else if (targetStatus === 'Parcel Sent') {
      parcelSentAtVal = now;
    } else if (targetStatus === 'Under Review') {
      underReviewAtVal = now;
    } else if (targetStatus === 'In Discussion') {
      inDiscussionAtVal = now;
    } else if (targetStatus === 'Product Returned') {
      productReturnedAtVal = now;
    }

    const newRecord = await Influencer.create({
      sNo: count + 1,
      transactionDate: transactionDate ? new Date(transactionDate) : undefined,
      connectedDate: connectedDate ? new Date(connectedDate) : new Date(),
      influencerManager: influencerManager ? getCanonicalManagerName(influencerManager) : (req.user?.name ? getCanonicalManagerName(req.user.name) : ''),
      brandManagerTeam: brandManagerTeam || '',
      brandId: brandId || undefined,
      brandName: finalBrandName || 'General',
      influencerName,
      influencerInstagramId: finalInstaId,
      phone: phone || '',
      profileLink: profileLink || finalInstaId || '',
      category: category || 'Paid',

      brandOnboardingAmt: bOnboard,
      brandReceivedAmt: bRecv,
      brandPendingAmt: bPend,
      influencerOnboardingAmt: infOnboard,
      influencerPaidAmt: infPaid,
      influencerPendingAmt: infPend,
      ad2shipMargin,
      inAmount: inAmt,
      outAmount: outAmt,
      balance,
      finalPaymentReceived: !!finalPaymentReceived,

      productLink: productLink || '',
      videoType: videoType || 'Single Product Video',
      videoDescription: videoDescription || '',
      refVideoLink: finalRefLink,
      orderId: orderId || '',
      orderDate: orderDate ? new Date(orderDate) : undefined,
      platform: platform || 'Instagram',
      status: targetStatus,
      completedAt: completedAtVal,
      parcelSentAt: parcelSentAtVal,
      underReviewAt: underReviewAtVal,
      inDiscussionAt: inDiscussionAtVal,
      productReturnedAt: productReturnedAtVal,
      statusUpdatedAt: now,
      contentLink: contentLink || '',
      adsCode: adsCode || '',
      viewsCount: Number(viewsCount) || 0,
      ordersCount: actualOrders,
      ordersGenerated: actualOrders,
      isOrderBonusQualified,
      isApproved: isApproved !== undefined ? !!isApproved : (approvalStatus === 'Approved' || targetStatus === 'Approved' || targetStatus === 'Completed'),
      approvalStatus: approvalStatus || (targetStatus === 'Approved' || targetStatus === 'Completed' ? 'Approved' : 'Pending'),
      reason: (reason !== undefined && reason !== null && String(reason).trim() !== '') ? String(reason).trim() : (remark || remarks || ''),
      notes: notes ? String(notes).trim() : '',
      remark: (remark !== undefined && remark !== null && String(remark).trim() !== '') ? String(remark).trim() : (remarks || reason || ''),
      createdBy: req.user?._id
    });

    // Automatically create Payment Log entries if financial amounts are present
    if (bRecv > 0) {
      await PaymentLog.create({
        influencerId: newRecord._id,
        influencerName: newRecord.influencerName,
        brandName: newRecord.brandName,
        type: 'IN',
        amount: bRecv,
        paymentMode: 'Bank Transfer',
        transactionDate: newRecord.transactionDate || new Date(),
        notes: `Brand onboarding payment received for ${newRecord.influencerName}`
      });
    }

    if (infPaid > 0) {
      await PaymentLog.create({
        influencerId: newRecord._id,
        influencerName: newRecord.influencerName,
        brandName: newRecord.brandName,
        type: 'OUT',
        amount: infPaid,
        paymentMode: 'Bank Transfer',
        transactionDate: newRecord.transactionDate || new Date(),
        notes: `Influencer payout disbursed for ${newRecord.influencerName}`
      });
    }

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'User',
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'Employee',
      action: 'CREATE_RECORD',
      module: category === 'Barter' ? 'Barter Ledger' : 'Paid Collaborations',
      entity: 'Influencer',
      entityId: (newRecord._id as any).toString(),
      details: `Created ${newRecord.category} collaboration for ${newRecord.brandName} with creator ${newRecord.influencerName}`,
      newValue: { influencerName: newRecord.influencerName, brandName: newRecord.brandName, category: newRecord.category, status: newRecord.status }
    });

    await triggerTargetSync();

    return res.status(200).json({ success: true, message: 'Influencer entry created successfully', data: newRecord });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error creating influencer record', error });
  }
});

// PUT /api/v1/influencers/:id
router.put('/:id', authenticateToken, checkPermission('influencer.update'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      influencerName, influencerManager, brandManagerTeam, brandId, brandName, phone, profileLink, influencerInstagramId, category,
      brandOnboardingAmt, brandReceivedAmt, influencerOnboardingAmt, influencerPaidAmt, finalPaymentReceived,
      inAmount, outAmount, productLink, videoType, videoDescription, refVideoLink, referenceVideoLink, orderId, orderDate,
      platform, status, contentLink, adsCode, viewsCount, ordersCount, ordersGenerated, isApproved, approvalStatus, reason, notes, remark, remarks, transactionDate, connectedDate
    } = req.body;

    const record = await Influencer.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'No record exists for this influencer' });
    }

    const oldStatus = record.status;
    const oldInfluencerName = record.influencerName;

    if (influencerName !== undefined) record.influencerName = influencerName;
    if (influencerManager !== undefined) record.influencerManager = getCanonicalManagerName(influencerManager);
    if (brandManagerTeam !== undefined) record.brandManagerTeam = brandManagerTeam;
    if (brandId !== undefined) record.brandId = brandId || undefined;
    if (brandName) record.brandName = brandName;
    if (phone !== undefined) record.phone = phone;
    if (influencerInstagramId !== undefined) record.influencerInstagramId = influencerInstagramId;
    if (profileLink !== undefined) record.profileLink = profileLink;

    if (category) record.category = category;

    if (brandOnboardingAmt !== undefined) record.brandOnboardingAmt = Number(brandOnboardingAmt) || 0;
    if (brandReceivedAmt !== undefined) record.brandReceivedAmt = Number(brandReceivedAmt) || 0;
    record.brandPendingAmt = record.brandOnboardingAmt - record.brandReceivedAmt;

    if (influencerOnboardingAmt !== undefined) record.influencerOnboardingAmt = Number(influencerOnboardingAmt) || 0;
    if (influencerPaidAmt !== undefined) record.influencerPaidAmt = Number(influencerPaidAmt) || 0;
    record.influencerPendingAmt = record.influencerOnboardingAmt - record.influencerPaidAmt;

    record.ad2shipMargin = record.brandOnboardingAmt - record.influencerOnboardingAmt;
    record.inAmount = record.brandReceivedAmt;
    record.outAmount = record.influencerPaidAmt;
    record.balance = record.inAmount - record.outAmount;

    if (finalPaymentReceived !== undefined) record.finalPaymentReceived = !!finalPaymentReceived;
    if (productLink !== undefined) record.productLink = productLink;
    if (videoType !== undefined) record.videoType = videoType;
    if (videoDescription !== undefined) record.videoDescription = videoDescription;
    if (refVideoLink !== undefined) record.refVideoLink = refVideoLink;
    if (referenceVideoLink !== undefined) record.refVideoLink = referenceVideoLink;
    if (orderId !== undefined) record.orderId = orderId;
    if (orderDate !== undefined) record.orderDate = orderDate ? new Date(orderDate) : undefined;
    if (platform) record.platform = platform;
    if (status) {
      const isStatusChanged = oldStatus !== status;
      record.status = status;
      if (isStatusChanged) {
        const now = new Date();
        record.statusUpdatedAt = now;
        if (status === 'Completed' || status === 'Approved' || status === 'Settled') {
          record.isApproved = true;
          record.approvalStatus = 'Approved';
          if (!record.completedAt) record.completedAt = now;
        } else if (status === 'Parcel Sent') {
          if (!record.parcelSentAt) record.parcelSentAt = now;
        } else if (status === 'Under Review') {
          if (!record.underReviewAt) record.underReviewAt = now;
          record.isApproved = false;
          record.approvalStatus = 'Pending';
        } else if (status === 'In Discussion') {
          if (!record.inDiscussionAt) record.inDiscussionAt = now;
        } else if (status === 'Product Returned') {
          if (!record.productReturnedAt) record.productReturnedAt = now;
          record.isApproved = false;
          record.approvalStatus = 'Pending';
        } else if (status === 'Pending') {
          record.isApproved = false;
          record.approvalStatus = 'Pending';
        }
      } else {
        if (status === 'Completed' || status === 'Approved' || status === 'Settled') {
          record.isApproved = true;
          record.approvalStatus = 'Approved';
        } else if (status === 'Under Review' || status === 'Pending' || status === 'Product Returned') {
          record.isApproved = false;
          record.approvalStatus = 'Pending';
        }
      }
    }
    if (req.body.completedAt !== undefined) {
      record.completedAt = req.body.completedAt ? new Date(req.body.completedAt) : undefined;
    }
    if (contentLink !== undefined) record.contentLink = contentLink;
    if (adsCode !== undefined) record.adsCode = adsCode;
    if (viewsCount !== undefined) record.viewsCount = Number(viewsCount) || 0;
    if (ordersGenerated !== undefined || ordersCount !== undefined) {
      const orders = Number(ordersGenerated !== undefined ? ordersGenerated : ordersCount) || 0;
      record.ordersGenerated = orders;
      record.ordersCount = orders;
      record.isOrderBonusQualified = (record.category === 'Paid') && orders >= 100;
    }
    if (isApproved !== undefined) record.isApproved = !!isApproved;
    if (approvalStatus !== undefined) record.approvalStatus = approvalStatus;
    const inputRemark = remark !== undefined ? remark : remarks;
    if (inputRemark !== undefined || reason !== undefined) {
      const cleanRemark = inputRemark !== undefined && inputRemark !== null ? String(inputRemark).trim() : '';
      const cleanReason = reason !== undefined && reason !== null ? String(reason).trim() : '';
      const effectiveVal = cleanRemark || cleanReason;
      record.remark = cleanRemark || effectiveVal;
      record.reason = cleanReason || effectiveVal;
    }
    if (notes !== undefined) record.notes = notes !== null ? String(notes).trim() : '';
    if (transactionDate !== undefined) record.transactionDate = transactionDate ? new Date(transactionDate) : (undefined as any);
    if (connectedDate !== undefined) record.connectedDate = connectedDate ? new Date(connectedDate) : (undefined as any);

    await record.save();

    const isStatusChanged = status !== undefined && oldStatus !== record.status;
    const isNameChanged = influencerName !== undefined && oldInfluencerName !== record.influencerName;

    let detailText = `Updated ${record.category} collaboration details for brand ${record.brandName} (${record.influencerName})`;
    if (isStatusChanged) {
      detailText = `Changed status of ${record.brandName} creator (${record.influencerName}) from "${oldStatus}" to "${record.status}"`;
    } else if (isNameChanged) {
      detailText = `Updated creator handle for ${record.brandName} from "${oldInfluencerName}" to "${record.influencerName}"`;
    }

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'User',
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'Employee',
      action: isStatusChanged ? 'UPDATE_STATUS' : 'EDIT_RECORD',
      module: record.category === 'Barter' ? 'Barter Ledger' : 'Paid Collaborations',
      entity: 'Influencer',
      entityId: (record._id as any).toString(),
      oldValue: { status: oldStatus, influencerName: oldInfluencerName },
      newValue: { status: record.status, influencerName: record.influencerName },
      details: detailText
    });

    await triggerTargetSync();

    return res.status(200).json({ success: true, message: 'Influencer record updated successfully', data: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating influencer record', error });
  }
});

// Helper to parse dates from various formats (Excel numbers, DD/MM/YYYY, ISO strings, etc.)
function parseImportDate(val: any, targetMonthStr?: string, targetYearNum?: number): Date {
  if (!val) {
    if (targetMonthStr && targetYearNum) {
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const mIdx = monthNames.indexOf(targetMonthStr.toLowerCase());
      if (mIdx !== -1) return new Date(Date.UTC(targetYearNum, mIdx, 15, 12, 0, 0));
    }
    return new Date();
  }

  // If it's already a Date
  if (val instanceof Date && !isNaN(val.getTime())) {
    if (val.getFullYear() >= 1990 && val.getFullYear() <= 2100) return val;
  }

  // Excel serial number as number or numeric string (e.g. 46253 or "46253" for 20/08/2026)
  const numVal = typeof val === 'number' ? val : (typeof val === 'string' && /^\d{4,6}(\.\d+)?$/.test(val.trim()) ? parseFloat(val.trim()) : null);
  if (numVal !== null && numVal > 10000 && numVal < 100000) {
    // Excel base epoch calculation (Jan 1, 1900 with leap year adjustment)
    const ms = Math.round((numVal - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }

  const str = String(val).trim();
  // Handle DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (e.g. 20/08/2026)
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(str)) {
    const parts = str.split(/[\/\-\.]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }

  // Handle YYYY-MM-DD
  if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/.test(str)) {
    const parts = str.split(/[\/\-\.]/);
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1990 && parsed.getFullYear() <= 2100) {
    return parsed;
  }

  if (targetMonthStr && targetYearNum) {
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const mIdx = monthNames.indexOf(targetMonthStr.toLowerCase());
    if (mIdx !== -1) return new Date(Date.UTC(targetYearNum, mIdx, 15, 12, 0, 0));
  }
  return new Date();
}

// Helper to normalize Collab Status
function normalizeCollabStatus(statStr: any): 'Pending' | 'In Discussion' | 'Parcel Sent' | 'Under Review' | 'Completed' | 'Settled' | 'Approved' {
  if (!statStr) return 'Pending';
  const s = String(statStr).trim().toLowerCase();
  if (s.includes('complete') || s === 'done' || s === 'completed') return 'Completed';
  if (s.includes('approve') || s === 'approved') return 'Approved';
  if (s.includes('settle') || s === 'settled') return 'Settled';
  if (s.includes('review') || s === 'under review') return 'Under Review';
  if (s.includes('parcel') || s.includes('sent') || s.includes('dispatch')) return 'Parcel Sent';
  if (s.includes('discuss') || s.includes('talk') || s.includes('connect')) return 'In Discussion';
  return 'Pending';
}

// Helper to extract column values case-insensitively
function getColValue(row: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    const match = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
    if (match && row[match] !== undefined && row[match] !== null && String(row[match]).trim().length > 0) {
      return String(row[match]).trim();
    }
  }
  return '';
}

// Helper to parse file/csv/rows into standard row objects
function extractRawRows(body: any): Record<string, any>[] {
  if (body.fileBase64) {
    const base64Data = String(body.fileBase64).replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  }
  if (body.csvText) {
    const workbook = XLSX.read(body.csvText, { type: 'string', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  }
  if (Array.isArray(body.rows)) {
    return body.rows;
  }
  return [];
}

// POST /api/v1/influencers/import-preview - Preview parsed records before committing import
router.post('/import-preview', authenticateToken, checkPermission('influencer.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { targetMonth, targetYear } = req.body;
    const rawRows = extractRawRows(req.body);

    if (rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No records found in the uploaded file or data.' });
    }

    const registeredUsers = await User.find({}, 'name email').lean();
    const registeredEmployees = await Employee.find({}, 'name email').lean();
    const validMemberNames = Array.from(new Set([
      ...registeredUsers.map(u => (u.name || '').trim()),
      ...registeredEmployees.map(e => (e.name || '').trim())
    ])).filter(name => name.length > 0);

    const matchPanelMember = (nameCandidate: string) => {
      if (!nameCandidate) return '';
      const clean = nameCandidate.trim().toLowerCase();
      const match = validMemberNames.find(m => {
        const lowM = m.toLowerCase();
        return lowM === clean || lowM.split(' ')[0] === clean || clean.split(' ')[0] === lowM;
      });
      return match || '';
    };

    const previewList = rawRows.slice(0, 15).map((row, idx) => {
      const dateVal = getColValue(row, 'Date', 'DATE', 'Transaction Date', 'Order Date', 'Column 1');
      const parsedDate = parseImportDate(dateVal, targetMonth, targetYear ? Number(targetYear) : undefined);
      const brandName = getColValue(row, 'Brand Name', 'BRAND NAME', 'Brand', 'BRAND') || 'General';
      const rawBrandManager = getColValue(row, 'Brand Manager', 'BRAND MANAGER', 'Manager');
      const rawAssignee = getColValue(row, 'Assigne', 'Assignee', 'ASSIGNEE', 'Assigned To', 'Influencer Manager');
      const rawTeam = getColValue(row, 'Brand Manager Team', 'Manager Team', 'Team');
      const collabType = getColValue(row, 'Collab Type', 'COLLAB TYPE', 'Category', 'CATEGORY', 'Type', 'TYPE') || 'Barter';
      const productLink = getColValue(row, 'Product Link', 'PRODUCT LINK', 'Product link');
      const videoType = getColValue(row, 'Type Of Video', 'Type of Video', 'TYPE OF VIDEO', 'Video Type') || 'Single Product Video';
      const refVideoLink = getColValue(row, 'ReferanceVideo Link', 'Referance Video Link', 'Reference Video Link', 'REFRENCE VIDEO LINK', 'Ref Link');
      const statusRaw = getColValue(row, 'Status', 'STATUS');
      const status = normalizeCollabStatus(statusRaw);
      const matchedAssignee = matchPanelMember(rawAssignee);
      const brandManagerVal = rawBrandManager || rawTeam || '';

      return {
        rowNumber: idx + 1,
        date: parsedDate.toISOString().split('T')[0],
        brandName,
        brandManager: brandManagerVal,
        assignee: matchedAssignee,
        collabType: collabType.toLowerCase().includes('paid') ? 'Paid' : 'Barter',
        productLink,
        videoType,
        refVideoLink,
        status
      };
    });

    return res.status(200).json({
      success: true,
      totalRows: rawRows.length,
      preview: previewList,
      sampleHeaders: Object.keys(rawRows[0] || {})
    });
  } catch (error) {
    console.error('Import preview error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process file preview', error });
  }
});

// POST /api/v1/influencers/import - Import historical/previous month collaboration records
router.post('/import', authenticateToken, checkPermission('influencer.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { targetMonth, targetYear } = req.body;
    const rawRows = extractRawRows(req.body);

    if (rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid records found to import.' });
    }

    // Pre-fetch brands & employees for matching
    const allBrands = await Brand.find({}).lean();
    const registeredUsers = await User.find({}, 'name email').lean();
    const registeredEmployees = await Employee.find({}, 'name email').lean();
    const validMemberNames = Array.from(new Set([
      ...registeredUsers.map(u => (u.name || '').trim()),
      ...registeredEmployees.map(e => (e.name || '').trim())
    ])).filter(name => name.length > 0);

    const matchPanelMember = (nameCandidate: string) => {
      if (!nameCandidate) return '';
      const clean = nameCandidate.trim().toLowerCase();
      const match = validMemberNames.find(m => {
        const lowM = m.toLowerCase();
        return lowM === clean || lowM.split(' ')[0] === clean || clean.split(' ')[0] === lowM;
      });
      return match || '';
    };

    const createdDocs: any[] = [];
    let currentCount = await Influencer.countDocuments();

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      const brandNameRaw = getColValue(row, 'Brand Name', 'BRAND NAME', 'Brand', 'BRAND');
      const rawInfName = getColValue(row, 'Influencers id', 'INFLUENCERS NAME / Instagram ID', 'Influencer Name', 'Influencer', 'INFLUENCERS NAME', 'Instagram ID');
      const rawAssignee = getColValue(row, 'Assigne', 'Assignee', 'ASSIGNEE', 'Assigned To', 'Influencer Manager');
      const rawBrandManager = getColValue(row, 'Brand Manager', 'BRAND MANAGER', 'Manager');
      const rawTeam = getColValue(row, 'Brand Manager Team', 'Manager Team', 'Team');
      const categoryRaw = getColValue(row, 'Collab Type', 'COLLAB TYPE', 'Category', 'CATEGORY', 'Type', 'TYPE') || 'Barter';
      const productLink = getColValue(row, 'Product Link', 'PRODUCT LINK', 'Product link');
      const videoType = getColValue(row, 'Type Of Video', 'Type of Video', 'TYPE OF VIDEO', 'Video Type') || 'Single Product Video';
      const videoDescription = getColValue(row, 'video description', 'Video Description', 'Description');
      const refVideoLink = getColValue(row, 'ReferanceVideo Link', 'Referance Video Link', 'Reference Video Link', 'REFRENCE VIDEO LINK', 'Ref Link');
      const orderId = getColValue(row, 'Order ID', 'OrderID', 'Order Id');
      const statusRaw = getColValue(row, 'Status', 'STATUS');
      const dateVal = getColValue(row, 'Date', 'DATE', 'Transaction Date', 'Order Date', 'Column 1');

      // Skip row if it has no usable information
      if (!brandNameRaw && !rawInfName && !orderId && !productLink && !videoDescription) {
        continue;
      }

      const finalBrandName = brandNameRaw || 'General';
      const matchedBrand = allBrands.find(b => b.brandName.trim().toLowerCase() === finalBrandName.trim().toLowerCase());

      // Date parsing
      const transactionDate = parseImportDate(dateVal, targetMonth, targetYear ? Number(targetYear) : undefined);

      // Category
      const isPaid = categoryRaw.trim().toLowerCase() === 'paid' || categoryRaw.trim().toLowerCase().includes('paid');
      const category = isPaid ? 'Paid' : 'Barter';

      // Assignee matching: strictly allow ONLY registered panel members
      const assignedManager = matchPanelMember(rawAssignee) || '';
      // Brand Manager: can be anyone (external or internal)
      const brandManager = rawBrandManager || rawTeam || '';

      // Status
      const finalStatus = normalizeCollabStatus(statusRaw);
      const isApproved = finalStatus === 'Completed' || finalStatus === 'Approved' || finalStatus === 'Settled';

      // Financials (if Paid)
      const bOnboard = Number(getColValue(row, 'Brand Price (IN)', 'Brand Price', 'Brand Onboarding Amt', 'inAmount')) || 0;
      const infOnboard = Number(getColValue(row, 'Creator Price (OUT)', 'Creator Price', 'Influencer Onboarding Amt', 'outAmount')) || 0;
      const ad2shipMargin = (bOnboard || 0) - (infOnboard || 0);

      // Clean instagram handle & name (do NOT use productLink or non-instagram URLs)
      const { name: cleanName, handle: instaHandle, link: profileUrl } = cleanInstagramHandleAndLink(rawInfName);

      currentCount++;
      const doc = await Influencer.create({
        sNo: currentCount,
        transactionDate,
        connectedDate: transactionDate,
        brandId: matchedBrand ? matchedBrand._id : undefined,
        brandName: matchedBrand ? matchedBrand.brandName : finalBrandName,
        influencerManager: assignedManager,
        brandManagerTeam: brandManager,
        influencerName: cleanName || '',
        influencerInstagramId: instaHandle || '',
        profileLink: profileUrl || '',
        category,
        brandOnboardingAmt: bOnboard,
        brandReceivedAmt: bOnboard,
        influencerOnboardingAmt: infOnboard,
        influencerPaidAmt: infOnboard,
        ad2shipMargin,
        inAmount: bOnboard,
        outAmount: infOnboard,
        productLink,
        videoType,
        videoDescription,
        refVideoLink,
        orderId,
        orderDate: orderId ? transactionDate : undefined,
        status: finalStatus,
        isApproved,
        approvalStatus: isApproved ? 'Approved' : 'Pending',
        googleSheetId: 'manual_import', // Marks record as manually imported so auto-sync poller does NOT overwrite or delete it
        createdBy: req.user?._id
      });

      createdDocs.push(doc);
    }

    // Log Activity
    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'User',
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'Employee',
      action: 'IMPORT_RECORDS',
      module: 'Influencer Management',
      entity: 'Influencer',
      details: `Imported ${createdDocs.length} collaboration records (Previous/Custom Month Data)`
    });

    // Recalculate targets
    await triggerTargetSync();

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${createdDocs.length} collaboration record(s)!`,
      count: createdDocs.length
    });
  } catch (error) {
    console.error('Import collaboration error:', error);
    return res.status(500).json({ success: false, message: 'Failed to import collaboration records', error });
  }
});

// POST /api/v1/influencers/bulk-delete - Bulk soft delete records
router.post('/bulk-delete', authenticateToken, checkPermission('influencer.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of record IDs to delete' });
    }

    const records = await Influencer.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'No active records found matching the provided IDs' });
    }

    const now = new Date();
    await Influencer.updateMany(
      { _id: { $in: ids }, isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          deletedAt: now,
          deletedBy: req.user?._id
        }
      }
    );

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'User',
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'Employee',
      action: 'BULK_DELETE_RECORD',
      module: 'Influencer Management',
      entity: 'Influencer',
      details: `Soft-deleted ${records.length} influencer collaboration record(s)`
    });

    await triggerTargetSync();

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${records.length} collaboration record(s)`,
      deletedCount: records.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error bulk deleting influencer records', error });
  }
});

// DELETE /api/v1/influencers/bulk-delete - Also support bulk delete via DELETE method
router.delete('/bulk-delete', authenticateToken, checkPermission('influencer.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of record IDs to delete' });
    }

    const records = await Influencer.find({ _id: { $in: ids }, isDeleted: { $ne: true } });
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'No active records found matching the provided IDs' });
    }

    const now = new Date();
    await Influencer.updateMany(
      { _id: { $in: ids }, isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          deletedAt: now,
          deletedBy: req.user?._id
        }
      }
    );

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'User',
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'Employee',
      action: 'BULK_DELETE_RECORD',
      module: 'Influencer Management',
      entity: 'Influencer',
      details: `Soft-deleted ${records.length} influencer collaboration record(s)`
    });

    await triggerTargetSync();

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${records.length} collaboration record(s)`,
      deletedCount: records.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error bulk deleting influencer records', error });
  }
});

// GET /api/v1/influencers/brand-collaborations
// External / Cross-Panel API to fetch brand-wise collaborations for Onboarding Panel / External portals
router.get('/brand-collaborations', authenticateOrApiKey, async (req: AuthRequest, res: Response) => {
  try {
    const {
      brandName,
      onboardingBrandId,
      sellerId,
      category,
      status,
      timeframe,
      year,
      month,
      page,
      limit
    } = req.query;

    const rawBrandName = brandName ? String(brandName).trim() : '';
    const rawOnboardingBrandId = onboardingBrandId !== undefined && onboardingBrandId !== null && String(onboardingBrandId).trim() !== ''
      ? String(onboardingBrandId).trim()
      : null;
    const rawSellerId = sellerId !== undefined && sellerId !== null && String(sellerId).trim() !== ''
      ? String(sellerId).trim()
      : null;

    if (!rawBrandName && !rawOnboardingBrandId) {
      return res.status(400).json({
        success: false,
        message: 'Either brandName or onboardingBrandId is required to fetch collaborations.'
      });
    }

    // 1. Resolve Brand in MongoDB (Hybrid Option 3):
    // Primary: Match by onboardingBrandId if provided
    let brandDoc: any = null;
    if (rawOnboardingBrandId) {
      brandDoc = await Brand.findOne({
        isDeleted: { $ne: true },
        $or: [
          { onboardingBrandId: rawOnboardingBrandId },
          { onboardingBrandId: Number(rawOnboardingBrandId) || -999999 }
        ]
      });
    }

    // Fallback: Match by normalized brandName (case-insensitive regex)
    if (!brandDoc && rawBrandName) {
      const nameRegex = new RegExp(`^${escapeRegex(rawBrandName)}$`, 'i');
      brandDoc = await Brand.findOne({
        isDeleted: { $ne: true },
        brandName: nameRegex
      });

      // Flexible stripped-whitespace match (e.g. "Art of colours" vs "Art Of Colours")
      if (!brandDoc) {
        const stripped = rawBrandName.replace(/\s+/g, '');
        const strippedRegex = new RegExp(`^${escapeRegex(stripped)}$`, 'i');
        brandDoc = await Brand.findOne({
          isDeleted: { $ne: true },
          brandName: strippedRegex
        });
      }

      // Auto-Link: When brand is matched by name and onboardingBrandId is provided, save link permanently
      if (brandDoc && rawOnboardingBrandId) {
        let needsSave = false;
        if (!brandDoc.onboardingBrandId || String(brandDoc.onboardingBrandId) !== rawOnboardingBrandId) {
          brandDoc.onboardingBrandId = Number(rawOnboardingBrandId) || rawOnboardingBrandId;
          needsSave = true;
        }
        if (rawSellerId && (!brandDoc.sellerId || String(brandDoc.sellerId) !== rawSellerId)) {
          brandDoc.sellerId = Number(rawSellerId) || rawSellerId;
          needsSave = true;
        }
        if (needsSave) {
          await brandDoc.save();
        }
      }
    }

    const targetBrandName = brandDoc ? brandDoc.brandName : rawBrandName;

    // 2. Fetch Active Assigned Team Members for this Brand (Posting, Barter, Paid)
    const assignedTeam: {
      postingExecutive: any;
      barterExecutive: any;
      paidExecutive: any;
    } = {
      postingExecutive: null,
      barterExecutive: null,
      paidExecutive: null
    };

    if (brandDoc) {
      const activeAssignments = await EmployeeBrand.find({
        brandId: brandDoc._id,
        status: 'Active'
      }).populate('employeeId', 'name designation email phone').lean();

      for (const asgn of activeAssignments) {
        const emp = asgn.employeeId as any;
        if (!emp) continue;
        const type = asgn.assignmentType || 1;
        const empSummary = {
          id: emp._id,
          name: emp.name,
          designation: emp.designation,
          email: emp.email,
          phone: emp.phone
        };
        if (type === 1 && !assignedTeam.postingExecutive) assignedTeam.postingExecutive = empSummary;
        if (type === 2 && !assignedTeam.barterExecutive) assignedTeam.barterExecutive = empSummary;
        if (type === 3 && !assignedTeam.paidExecutive) assignedTeam.paidExecutive = empSummary;
      }
    }

    // 3. Build Collaborations Query Filter
    const colabFilter: any = { isDeleted: { $ne: true } };

    if (brandDoc) {
      colabFilter.$or = [
        { brandId: brandDoc._id },
        { brandName: new RegExp(`^${escapeRegex(brandDoc.brandName.trim())}$`, 'i') }
      ];
    } else {
      colabFilter.brandName = new RegExp(`^${escapeRegex(targetBrandName)}$`, 'i');
    }

    if (category && category !== 'All') {
      colabFilter.category = category;
    }
    if (status && status !== 'All') {
      colabFilter.status = status;
    }

    // Optional Timeframe filter
    const now = new Date();
    const currentYear = Number(year) || now.getFullYear();
    const currentMonth = month !== undefined ? Number(month) - 1 : now.getMonth();

    if (timeframe && (timeframe as string).includes('_')) {
      const parts = (timeframe as string).split('_');
      const monthNames: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      const mIdx = monthNames[parts[0].toLowerCase()];
      const yr = Number(parts[1]) || currentYear;
      if (mIdx !== undefined) {
        const startOfMonth = new Date(yr, mIdx, 1, 0, 0, 0);
        const endOfMonth = new Date(yr, mIdx + 1, 0, 23, 59, 59);
        colabFilter.transactionDate = { $gte: startOfMonth, $lte: endOfMonth };
      }
    } else if (timeframe === 'monthly' || timeframe === 'Month') {
      const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      colabFilter.transactionDate = { $gte: startOfMonth, $lte: endOfMonth };
    }

    // 4. Calculate Aggregate Metrics for this Brand
    const allMatching = await Influencer.find(colabFilter).lean();

    const totalCollaborations = allMatching.length;
    const paidCollabs = allMatching.filter(c => c.category === 'Paid');
    const barterCollabs = allMatching.filter(c => c.category === 'Barter');

    const completedCollabs = allMatching.filter(c =>
      ['Completed', 'Approved', 'Settled', 'completed', 'approved', 'settled'].includes(c.status)
    );
    const inProgressCollabs = allMatching.filter(c =>
      ['In Discussion', 'Parcel Sent', 'Under Review'].includes(c.status)
    );
    const pendingCollabs = allMatching.filter(c =>
      ['Pending', 'pending'].includes(c.status)
    );

    const totalReceivedAmt = paidCollabs.reduce((acc, c) => acc + (c.brandReceivedAmt || c.inAmount || 0), 0);
    const totalPaidAmt = paidCollabs.reduce((acc, c) => acc + (c.influencerPaidAmt || c.outAmount || 0), 0);
    const totalMargin = paidCollabs.reduce((acc, c) => acc + (c.ad2shipMargin || 0), 0);

    // 5. Pagination & Fetch
    const pageNum = page ? Math.max(1, Number(page)) : undefined;
    const limitNum = limit ? Math.max(1, Number(limit)) : undefined;

    let query = Influencer.find(colabFilter).sort({ transactionDate: -1, createdAt: -1 });
    if (pageNum !== undefined && limitNum !== undefined) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }
    const rawList = await query.lean();

    // 6. Clean, standardized response payload
    const formattedCollaborations = rawList.map(c => ({
      id: c._id,
      influencerName: c.influencerName || 'Creator',
      instagramHandle: c.influencerInstagramId || '',
      profileLink: c.profileLink || '',
      category: c.category || 'Barter',
      status: c.status || 'Pending',
      deliverableType: c.videoType || 'Post',
      videoDescription: c.videoDescription || '',
      productLink: c.productLink || '',
      contentLink: c.contentLink || '',
      referenceVideoLink: c.refVideoLink || '',
      handledBy: c.influencerManager || c.assignedExecutive || 'Unassigned',
      date: c.transactionDate || c.connectedDate || (c as any).createdAt,
      orderDate: c.orderDate || null,
      completedAt: c.completedAt || null,
      financials: {
        brandOnboardingAmt: c.brandOnboardingAmt || 0,
        brandReceivedAmt: c.brandReceivedAmt || c.inAmount || 0,
        influencerPaidAmt: c.influencerPaidAmt || c.outAmount || 0,
        margin: c.ad2shipMargin || 0
      },
      performance: {
        viewsCount: c.viewsCount || 0,
        ordersCount: c.ordersCount || c.ordersGenerated || 0,
        adsCode: c.adsCode || ''
      }
    }));

    return res.status(200).json({
      success: true,
      brand: {
        id: brandDoc?._id || null,
        brandId: brandDoc?.brandId || null,
        brandName: targetBrandName,
        onboardingBrandId: brandDoc?.onboardingBrandId || (rawOnboardingBrandId ? Number(rawOnboardingBrandId) || rawOnboardingBrandId : null),
        sellerId: brandDoc?.sellerId || (rawSellerId ? Number(rawSellerId) || rawSellerId : null),
        industry: brandDoc?.industry || '',
        status: brandDoc?.status || 'Active',
        assignedTeam
      },
      metrics: {
        totalCollaborations,
        paidCount: paidCollabs.length,
        barterCount: barterCollabs.length,
        completedCount: completedCollabs.length,
        inProgressCount: inProgressCollabs.length,
        pendingCount: pendingCollabs.length,
        financials: {
          totalReceivedAmt,
          totalPaidAmt,
          totalMargin
        }
      },
      pagination: {
        page: pageNum || 1,
        limit: limitNum || totalCollaborations,
        total: totalCollaborations,
        totalPages: limitNum ? Math.max(1, Math.ceil(totalCollaborations / limitNum)) : 1
      },
      collaborations: formattedCollaborations
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching brand collaborations',
      error: error?.message || error
    });
  }
});

// DELETE /api/v1/influencers/:id
router.delete('/:id', authenticateToken, checkPermission('influencer.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const record = await Influencer.findById(req.params.id);
    if (!record || record.isDeleted) {
      return res.status(404).json({ success: false, message: 'No record exists for this influencer' });
    }

    record.isDeleted = true;
    record.deletedAt = new Date();
    record.deletedBy = req.user?._id;
    await record.save();

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'User',
      userEmail: req.user?.email || '',
      userRole: req.user?.role || 'Employee',
      action: 'DELETE_RECORD',
      module: record.category === 'Barter' ? 'Barter Ledger' : 'Paid Collaborations',
      entity: 'Influencer',
      entityId: (record._id as any).toString(),
      details: `Deleted ${record.category} collaboration record for brand ${record.brandName} (${record.influencerName})`
    });

    await triggerTargetSync();

    return res.status(200).json({ success: true, message: 'Influencer record deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error deleting influencer record', error });
  }
});

// GET /api/v1/influencers/payment-logs
router.get('/payment-logs', authenticateToken, checkPermission('influencer.view', 'influencer.payment.view', 'influencer.paid.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { type, timeframe, year, month, search } = req.query;
    const filter: any = { isDeleted: { $ne: true } };

    if (req.user?.role === 'Barter Collab Executive' || req.user?.role === 'Posting & Content Executive') {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to view payment audit logs.' });
    }

    if (type && type !== 'All') {
      filter.type = type;
    }

    if (req.user?.role === 'Employee' || req.user?.role === 'Paid Collab Executive') {
      const employeeDoc = await getEmployeeForAuthUser(req.user);
      if (employeeDoc) {
        const empNameRegex = getManagerSearchRegex(employeeDoc.name);

        const assignmentQuery: any = {
          employeeId: employeeDoc._id,
          status: 'Active'
        };
        if (req.user.role === 'Paid Collab Executive') {
          assignmentQuery.assignmentType = { $in: [3, null] };
        }

        const assignments = await EmployeeBrand.find(assignmentQuery).lean();
        const assignedBrandIds = assignments.map(a => a.brandId);

        const assignedBrands = await Brand.find({ _id: { $in: assignedBrandIds } }).select('brandName').lean();
        const brandNames = assignedBrands.map(b => b.brandName).filter(Boolean);
        const brandNameRegexes = brandNames.map(name => new RegExp(`^${escapeRegex(name.trim())}$`, 'i'));

        const scopingConditions: any[] = [
          { handledBy: empNameRegex },
          { createdBy: req.user._id },
          { handledBy: { $in: ['', null, 'Unassigned'] } }
        ];

        if (assignedBrandIds.length > 0) {
          scopingConditions.push({ brandId: { $in: assignedBrandIds } });
        }
        if (brandNameRegexes.length > 0) {
          scopingConditions.push({ brandName: { $in: brandNameRegexes } });
        }

        filter.$and = filter.$and || [];
        filter.$and.push({ $or: scopingConditions });
      }
    }

    const now = new Date();
    const currentYear = Number(year) || now.getFullYear();
    const currentMonth = month !== undefined ? Number(month) - 1 : now.getMonth();

    if (timeframe && (timeframe as string).includes('_')) {
      const parts = (timeframe as string).split('_');
      const monthNames: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      const mIdx = monthNames[parts[0].toLowerCase()];
      const yr = Number(parts[1]) || 2026;
      if (mIdx !== undefined) {
        const startOfMonth = new Date(yr, mIdx, 1, 0, 0, 0);
        const endOfMonth = new Date(yr, mIdx + 1, 0, 23, 59, 59);
        filter.transactionDate = { $gte: startOfMonth, $lte: endOfMonth };
      }
    } else if (timeframe === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      filter.transactionDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (timeframe === 'monthly' || timeframe === 'Month') {
      const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      filter.transactionDate = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (timeframe === 'yearly' || timeframe === 'Year') {
      const startOfYear = new Date(currentYear, 0, 1, 0, 0, 0);
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);
      filter.transactionDate = { $gte: startOfYear, $lte: endOfYear };
    }

    if (search && typeof search === 'string' && search.trim()) {
      const sRegex = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { influencerName: sRegex },
          { brandName: sRegex },
          { handledBy: sRegex },
          { referenceNo: sRegex }
        ]
      });
    }

    const pageNum = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limitNum = req.query.limit ? Math.max(1, Number(req.query.limit)) : 10;

    const allLogs = await PaymentLog.find(filter).select('type amount');
    const totalIn = allLogs.filter(l => l.type === 'IN').reduce((acc, l) => acc + (l.amount || 0), 0);
    const totalOut = allLogs.filter(l => l.type === 'OUT').reduce((acc, l) => acc + (l.amount || 0), 0);
    const totalCount = allLogs.length;

    let query = PaymentLog.find(filter).sort({ transactionDate: -1, createdAt: -1 });
    if (pageNum !== undefined) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }
    const logs = await query;

    return res.status(200).json({
      success: true,
      data: logs,
      metrics: {
        totalIn,
        totalOut,
        netBalance: totalIn - totalOut,
        totalCount
      },
      pagination: {
        page: pageNum || 1,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limitNum))
      },
      message: logs.length === 0 ? 'No records found' : 'Payment logs fetched successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching payment logs', error });
  }
});

// POST /api/v1/influencers/payment-logs
router.post('/payment-logs', authenticateToken, checkPermission('influencer.create', 'influencer.payment.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { influencerId, influencerName, brandName, type, amount, paymentMode, referenceNo, handledBy, notes, transactionDate } = req.body;

    if (!influencerName || !brandName || !type || !amount) {
      return res.status(400).json({ success: false, message: 'Influencer name, brand name, type, and amount are required' });
    }

    const newLog = await PaymentLog.create({
      influencerId: influencerId || undefined,
      influencerName,
      brandName,
      type,
      amount: Number(amount) || 0,
      paymentMode: paymentMode || 'UPI',
      referenceNo: referenceNo || '',
      handledBy: handledBy || req.user?.name || 'Admin',
      notes: notes || '',
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      createdBy: req.user?._id
    });

    // If linked to an influencer record, auto update financial totals
    if (influencerId) {
      const inf = await Influencer.findById(influencerId);
      if (inf) {
        if (type === 'IN') {
          inf.brandReceivedAmt = (inf.brandReceivedAmt || 0) + Number(amount);
          inf.brandPendingAmt = inf.brandOnboardingAmt - inf.brandReceivedAmt;
          inf.inAmount = inf.brandReceivedAmt;
        } else if (type === 'OUT') {
          inf.influencerPaidAmt = (inf.influencerPaidAmt || 0) + Number(amount);
          inf.influencerPendingAmt = inf.influencerOnboardingAmt - inf.influencerPaidAmt;
          inf.outAmount = inf.influencerPaidAmt;
        }
        inf.balance = inf.inAmount - inf.outAmount;
        await inf.save();
      }
    }

    return res.status(200).json({ success: true, message: 'Payment log created successfully', data: newLog });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error creating payment log', error });
  }
});

// DELETE /api/v1/influencers/payment-logs/:id
router.delete('/payment-logs/:id', authenticateToken, checkPermission('influencer.delete', 'influencer.payment.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await PaymentLog.findById(req.params.id);
    if (!deleted || deleted.isDeleted) {
      return res.status(404).json({ success: false, message: 'No record exists for this payment log' });
    }
    deleted.isDeleted = true;
    deleted.deletedAt = new Date();
    deleted.deletedBy = req.user?._id;
    await deleted.save();

    return res.status(200).json({ success: true, message: 'Payment log deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error deleting payment log', error });
  }
});

export default router;
