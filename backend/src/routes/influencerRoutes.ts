import { Router, Response } from 'express';
import * as XLSX from 'xlsx';
import { Influencer, Brand, PaymentLog, Employee, EmployeeBrand, Target, InfluencerDirectory, User } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
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

// GET /api/v1/influencers
router.get('/', authenticateToken, checkPermission('influencer.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { category, timeframe, year, month, search, brand, manager, status, deliverable } = req.query;
    const filter: any = { isDeleted: { $ne: true } };

    // 0. Employee Role Scoping (Only show data where employee is the assigned manager/executive)
    if (req.user?.role === 'Employee') {
      const employeeDoc = await getEmployeeForAuthUser(req.user);
      if (employeeDoc) {
        const empNameRegex = new RegExp(`^${employeeDoc.name.trim()}$`, 'i');

        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { influencerManager: empNameRegex },
            { assignedExecutive: empNameRegex },
            { createdBy: req.user._id }
          ]
        });
      }
    }

    // 1. Sub-module Category Filter (Paid vs Barter)
    if (category && category !== 'All') {
      filter.category = category;
    }

    // 2. Timeframe Filter (Today, Monthly, Yearly) — Matches transactionDate OR connectedDate/createdAt if transactionDate is blank
    const now = new Date();
    const currentYear = Number(year) || now.getFullYear();
    const currentMonth = month !== undefined ? Number(month) - 1 : now.getMonth();

    const getDateQuery = (start: Date, end: Date) => ({
      $or: [
        { transactionDate: { $gte: start, $lte: end } },
        {
          $and: [
            { $or: [{ transactionDate: { $exists: false } }, { transactionDate: null }] },
            {
              $or: [
                { connectedDate: { $gte: start, $lte: end } },
                { createdAt: { $gte: start, $lte: end } }
              ]
            }
          ]
        }
      ]
    });

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
        const mgrRegex = new RegExp(escapeRegex(manager.trim()), 'i');
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
    }

    // Global Tab Counts for this timeframe & employee scope (stable across tab switches)
    const timeScopedBase: any = { isDeleted: { $ne: true } };
    if (filter.$and) {
      timeScopedBase.$and = filter.$and;
    }

    const [allDistinctBrands, allDistinctManagers, allDistinctStatuses, allDistinctDeliverables, allMatching, paidCount, barterCount, allCount] = await Promise.all([
      Influencer.distinct('brandName', baseCategoryFilter),
      Influencer.distinct('influencerManager', baseCategoryFilter),
      Influencer.distinct('status', baseCategoryFilter),
      Influencer.distinct('videoType', baseCategoryFilter),
      Influencer.find(filter).select('inAmount outAmount'),
      Influencer.countDocuments({ ...timeScopedBase, category: 'Paid' }),
      Influencer.countDocuments({ ...timeScopedBase, category: 'Barter' }),
      Influencer.countDocuments(timeScopedBase)
    ]);

    const totalIn = allMatching.reduce((acc, curr) => acc + (curr.inAmount || 0), 0);
    const totalOut = allMatching.reduce((acc, curr) => acc + (curr.outAmount || 0), 0);
    const netBalance = totalIn - totalOut;
    const totalCount = allMatching.length;

    let query = Influencer.find(filter)
      .populate('brandId', 'brandName brandId logo')
      .sort({ transactionDate: 1, orderDate: 1, sNo: 1 });

    if (pageNum !== undefined && limitNum !== undefined) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const influencers = await query;

    return res.status(200).json({
      success: true,
      timeframe: timeframe || 'all',
      metrics: {
        totalIn,
        totalOut,
        netBalance,
        totalCount
      },
      tabCounts: {
        paid: paidCount,
        barter: barterCount,
        all: allCount
      },
      filterOptions: {
        brands: (allDistinctBrands as string[]).filter(Boolean).map(s => s.trim()).filter((v, i, a) => a.indexOf(v) === i).sort(),
        managers: (allDistinctManagers as string[]).filter(Boolean).map(s => s.trim()).filter((v, i, a) => a.indexOf(v) === i).sort(),
        statuses: (allDistinctStatuses as string[]).filter(Boolean).map(s => s.trim()).filter((v, i, a) => a.indexOf(v) === i).sort(),
        deliverables: (allDistinctDeliverables as string[]).filter(Boolean).map(s => s.trim()).filter((v, i, a) => a.indexOf(v) === i).sort()
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
      platform, status, contentLink, adsCode, viewsCount, ordersCount, ordersGenerated, isApproved, approvalStatus, reason, notes, remark, transactionDate, connectedDate
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

    const newRecord = await Influencer.create({
      sNo: count + 1,
      transactionDate: transactionDate ? new Date(transactionDate) : undefined,
      connectedDate: connectedDate ? new Date(connectedDate) : new Date(),
      influencerManager: influencerManager || req.user?.name || '',
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
      contentLink: contentLink || '',
      adsCode: adsCode || '',
      viewsCount: Number(viewsCount) || 0,
      ordersCount: actualOrders,
      ordersGenerated: actualOrders,
      isOrderBonusQualified,
      isApproved: isApproved !== undefined ? !!isApproved : (approvalStatus === 'Approved' || targetStatus === 'Approved' || targetStatus === 'Completed'),
      approvalStatus: approvalStatus || (targetStatus === 'Approved' || targetStatus === 'Completed' ? 'Approved' : 'Pending'),
      reason: reason || '',
      notes: notes || '',
      remark: remark || '',
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
      platform, status, contentLink, adsCode, viewsCount, ordersCount, ordersGenerated, isApproved, approvalStatus, reason, notes, remark, transactionDate, connectedDate
    } = req.body;

    const record = await Influencer.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'No record exists for this influencer' });
    }

    const oldStatus = record.status;
    const oldInfluencerName = record.influencerName;

    if (influencerName !== undefined) record.influencerName = influencerName;
    if (influencerManager !== undefined) record.influencerManager = influencerManager;
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
      record.status = status;
      if (status === 'Completed' || status === 'Approved' || status === 'Settled') {
        record.isApproved = true;
        record.approvalStatus = 'Approved';
      } else if (status === 'Under Review' || status === 'Pending') {
        record.isApproved = false;
        record.approvalStatus = 'Pending';
      }
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
    if (reason !== undefined) record.reason = reason;
    if (notes !== undefined) record.notes = notes;
    if (remark !== undefined) record.remark = remark;
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
router.get('/payment-logs', authenticateToken, checkPermission('influencer.view'), async (req: AuthRequest, res: Response) => {
  try {
    const { type, timeframe, year, month, search } = req.query;
    const filter: any = { isDeleted: { $ne: true } };

    if (type && type !== 'All') {
      filter.type = type;
    }

    if (req.user?.role === 'Employee') {
      const employeeDoc = await getEmployeeForAuthUser(req.user);
      if (employeeDoc) {
        const empNameRegex = new RegExp(`^${employeeDoc.name.trim()}$`, 'i');

        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { handledBy: empNameRegex },
            { createdBy: req.user._id }
          ]
        });
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

    if (search) {
      filter.$or = [
        { influencerName: { $regex: search, $options: 'i' } },
        { brandName: { $regex: search, $options: 'i' } },
        { handledBy: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limitNum = req.query.limit ? Math.max(1, Number(req.query.limit)) : 10;

    const allLogs = await PaymentLog.find(filter).select('type amount');
    const totalIn = allLogs.filter(l => l.type === 'IN').reduce((acc, l) => acc + (l.amount || 0), 0);
    const totalOut = allLogs.filter(l => l.type === 'OUT').reduce((acc, l) => acc + (l.amount || 0), 0);
    const totalCount = allLogs.length;

    let query = PaymentLog.find(filter).sort({ transactionDate: 1, createdAt: 1 });
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
router.post('/payment-logs', authenticateToken, checkPermission('influencer.create'), async (req: AuthRequest, res: Response) => {
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
router.delete('/payment-logs/:id', authenticateToken, checkPermission('influencer.delete'), async (req: AuthRequest, res: Response) => {
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
