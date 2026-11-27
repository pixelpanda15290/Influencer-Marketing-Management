import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { InfluencerApplication, Brand, BrandRequirement, Influencer, User } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logActivity } from '../middleware/auditLog';
import { sendBrandAllotmentEmail } from '../services/emailService';

const router = Router();

// Helper to sanitize Instagram handle & URL
const sanitizeHandle = (rawHandle?: string) => {
  let handle = (rawHandle || '').trim();
  if (!handle) return { handle: '', url: '' };

  if (handle.includes('instagram.com/')) {
    const cleanUrl = handle.split('?')[0].split('#')[0];
    const parts = cleanUrl.split('/').filter(Boolean);
    const candidate = parts.pop() || '';
    handle = candidate.replace(/^@/, '').trim();
  } else {
    handle = handle.replace(/^@/, '').replace(/\s+/g, '').trim();
  }

  const cleanHandle = `@${handle}`;
  const cleanUrl = `https://instagram.com/${handle}`;
  return { handle: cleanHandle, url: cleanUrl };
};

// Helper to format clean phone for WhatsApp wa.me links
const formatCleanPhone = (rawPhone: string) => {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`; // Default to India (+91) if 10 digits
  }
  return digits;
};

const COMPLETED_STATUSES = new Set(['Completed', 'Settled', 'Approved']);
const LONG_PENDING_DAYS_THRESHOLD = 7;

// Enrich applications with multi-brand allotment history, live Influencer tracking status, and pending aging
const enrichApplicationAllotments = async (apps: any[]) => {
  if (!Array.isArray(apps) || apps.length === 0) return apps;

  const trackingIds: mongoose.Types.ObjectId[] = [];
  const handles = new Set<string>();
  const phones = new Set<string>();

  apps.forEach(app => {
    if (app.instagramHandle) handles.add(app.instagramHandle);
    if (app.whatsappNumber) phones.add(app.whatsappNumber);
    if (Array.isArray(app.allotmentHistory)) {
      app.allotmentHistory.forEach((h: any) => {
        if (h.trackingInfluencerId && mongoose.Types.ObjectId.isValid(String(h.trackingInfluencerId))) {
          trackingIds.push(new mongoose.Types.ObjectId(String(h.trackingInfluencerId)));
        }
      });
    }
  });

  const orConditions: any[] = [];
  if (trackingIds.length > 0) orConditions.push({ _id: { $in: trackingIds } });
  if (handles.size > 0) orConditions.push({ influencerInstagramId: { $in: Array.from(handles) } });
  if (phones.size > 0) orConditions.push({ phone: { $in: Array.from(phones) } });

  const trackingDocs = orConditions.length > 0
    ? await Influencer.find({ isDeleted: { $ne: true }, $or: orConditions })
        .select('_id brandName productName brandRequirementId influencerInstagramId phone status contentLink viewsCount ordersGenerated parcelSentAt completedAt connectedDate createdAt')
        .lean()
    : [];

  const trackingById = new Map<string, any>();
  trackingDocs.forEach((t: any) => trackingById.set(String(t._id), t));

  const nowMs = Date.now();

  return apps.map(app => {
    let rawHistory: any[] = Array.isArray(app.allotmentHistory) ? [...app.allotmentHistory] : [];
    if (rawHistory.length === 0 && app.allottedBrandName) {
      rawHistory = [{
        _id: 'legacy-0',
        brandId: app.allottedBrandId,
        brandName: app.allottedBrandName,
        requirementId: app.allottedRequirementId,
        productName: app.allottedProductName || '',
        productLink: app.allottedProductLink || '',
        collabDescription: app.allottedCollabDescription || '',
        collabType: app.allottedCollabType || 'Barter',
        deliverables: app.allottedDeliverables || '',
        commercialAmount: app.allottedCommercial || 0,
        managerName: app.allottedManagerName || '',
        managerNotes: app.managerNotes || '',
        status: app.status || 'Brand Allotted',
        collabStatus: 'Pending',
        whatsappMessageText: app.whatsappMessageText || '',
        respondedAt: app.opportunityRespondedAt,
        allottedAt: app.allottedAt || app.createdAt
      }];
    }

    const enrichedHistory = rawHistory.map((entry: any) => {
      let matchedTracking = entry.trackingInfluencerId
        ? trackingById.get(String(entry.trackingInfluencerId))
        : null;

      if (!matchedTracking) {
        const entryBrand = (entry.brandName || '').trim().toLowerCase();
        const entryProd = (entry.productName || '').trim().toLowerCase();
        const entryReqId = entry.requirementId ? String(entry.requirementId) : '';

        matchedTracking = trackingDocs.find((t: any) => {
          const sameCreator =
            (app.instagramHandle && t.influencerInstagramId === app.instagramHandle) ||
            (app.whatsappNumber && t.phone === app.whatsappNumber);
          if (!sameCreator) return false;
          if ((t.brandName || '').trim().toLowerCase() !== entryBrand) return false;
          if (entryReqId && t.brandRequirementId && String(t.brandRequirementId) === entryReqId) return true;
          if (entryProd && (t.productName || '').trim().toLowerCase() === entryProd) return true;
          if (!entryProd && !(t.productName || '').trim()) return true;
          return false;
        });
      }

      const executionStatus = matchedTracking?.status || entry.collabStatus || 'Pending';
      const isDeclined = entry.status === 'Opportunity Declined';
      const isCompleted = COMPLETED_STATUSES.has(executionStatus);
      const isReturned = executionStatus === 'Product Returned';
      const rawParcelSentAt =
        matchedTracking?.parcelSentAt ||
        entry.parcelSentAt ||
        (executionStatus === 'Parcel Sent' ? (entry.allottedAt || app.allottedAt) : null);
      const isParcelTimerActive =
        Boolean(rawParcelSentAt) &&
        !isCompleted &&
        !isDeclined &&
        !isReturned &&
        executionStatus !== 'Pending' &&
        executionStatus !== 'In Discussion';
      const parcelDaysElapsed = isParcelTimerActive
        ? Math.max(0, Math.floor((nowMs - new Date(rawParcelSentAt).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const parcelDaysLeft = isParcelTimerActive ? Math.max(0, 14 - parcelDaysElapsed) : undefined;
      const isParcelOverdue = isParcelTimerActive && parcelDaysElapsed >= 14;
      const refDate = rawParcelSentAt || entry.allottedAt || app.allottedAt || app.createdAt;
      const daysPending = (!isCompleted && !isDeclined && !isReturned && refDate)
        ? Math.max(0, Math.floor((nowMs - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const isLongPending = isParcelOverdue || (!isCompleted && !isDeclined && !isReturned && daysPending >= LONG_PENDING_DAYS_THRESHOLD);

      return {
        ...entry,
        trackingInfluencerId: entry.trackingInfluencerId || matchedTracking?._id,
        executionStatus,
        daysPending,
        isLongPending,
        isCompleted,
        isParcelTimerActive,
        parcelDaysElapsed,
        parcelDaysLeft,
        isParcelOverdue,
        contentLink: matchedTracking?.contentLink || '',
        viewsCount: matchedTracking?.viewsCount || 0,
        ordersGenerated: matchedTracking?.ordersGenerated || 0,
        parcelSentAt: rawParcelSentAt || undefined,
        completedAt: matchedTracking?.completedAt || entry.completedAt
      };
    });

    const completedCollabsCount = enrichedHistory.filter((h: any) => h.isCompleted).length;
    const longPendingCollabsCount = enrichedHistory.filter((h: any) => h.isLongPending).length;
    const activeCollabsCount = enrichedHistory.filter((h: any) => !h.isCompleted && h.status !== 'Opportunity Declined').length;

    return {
      ...app,
      allotmentHistory: enrichedHistory,
      totalAllotments: enrichedHistory.length,
      completedCollabsCount,
      longPendingCollabsCount,
      activeCollabsCount
    };
  });
};

// ============================================================================
// 1. PUBLIC ROUTE: Submit Influencer Onboarding Form (Sent via WhatsApp Link)
// POST /api/v1/influencer-applications/submit
// ============================================================================
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      whatsappNumber,
      email,
      instagramHandle,
      followersCountBracket,
      category,
      otherCategory,
      city,
      state,
      collabTypePreference,
      costPerReel,
      costPerStory,
      languages,
      shippingAddress,
      nicheDetails,
      source
    } = req.body;

    // Basic Validation
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }
    if (!whatsappNumber || !whatsappNumber.trim()) {
      return res.status(400).json({ success: false, message: 'WhatsApp number is required' });
    }
    if (!email || !email.trim() || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid email address is required' });
    }
    if (!instagramHandle || !instagramHandle.trim()) {
      return res.status(400).json({ success: false, message: 'Instagram handle / profile link is required' });
    }

    const { handle: cleanHandle, url: instagramUrl } = sanitizeHandle(instagramHandle);

    // Save application to database
    const application = new InfluencerApplication({
      fullName: fullName.trim(),
      whatsappNumber: whatsappNumber.trim(),
      email: email.trim().toLowerCase(),
      instagramHandle: cleanHandle,
      instagramUrl,
      followersCountBracket: followersCountBracket || '10k - 50k',
      category: category || 'Fashion',
      otherCategory: otherCategory ? otherCategory.trim() : '',
      city: city ? city.trim() : 'Unspecified',
      state: state ? state.trim() : '',
      collabTypePreference: collabTypePreference || 'Both',
      costPerReel: Number(costPerReel) || 0,
      costPerStory: Number(costPerStory) || 0,
      languages: Array.isArray(languages) ? languages : (languages ? [languages] : []),
      shippingAddress: {
        addressLine: shippingAddress?.addressLine?.trim() || '',
        city: shippingAddress?.city?.trim() || city?.trim() || '',
        state: shippingAddress?.state?.trim() || state?.trim() || '',
        pincode: shippingAddress?.pincode?.trim() || '',
        landmark: shippingAddress?.landmark?.trim() || '',
        clothingSize: shippingAddress?.clothingSize?.trim() || nicheDetails?.clothingSize?.trim() || '',
        shoeSize: shippingAddress?.shoeSize?.trim() || nicheDetails?.shoeSize?.trim() || ''
      },
      nicheDetails: typeof nicheDetails === 'object' && nicheDetails !== null ? nicheDetails : {},
      status: 'Pending',
      source: source || 'WhatsApp Campaign Link'
    });

    await application.save();

    console.log(`[Influencer Application Received] ${fullName} (${cleanHandle}) - ${email}`);

    return res.status(201).json({
      success: true,
      message: 'Application received successfully! Our campaign team will review your profile and allot a matching brand campaign.',
      data: {
        id: application._id,
        fullName: application.fullName,
        instagramHandle: application.instagramHandle
      }
    });
  } catch (error: any) {
    console.error('Error submitting influencer application:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit application. Please try again.'
    });
  }
});

// ============================================================================
// 2. PROTECTED ROUTE: List Influencer Applications for Manager / Admin
// GET /api/v1/influencer-applications
// ============================================================================
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      collabType,
      category,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const filter: any = { isDeleted: { $ne: true } };

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (collabType && collabType !== 'All') {
      filter.collabTypePreference = { $in: [collabType, 'Both'] };
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { fullName: regex },
        { instagramHandle: regex },
        { email: regex },
        { whatsappNumber: regex },
        { city: regex },
        { allottedBrandName: regex },
        { allottedProductName: regex },
        { 'allotmentHistory.brandName': regex },
        { 'allotmentHistory.productName': regex }
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, totalCount, statsData] = await Promise.all([
      InfluencerApplication.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      InfluencerApplication.countDocuments(filter),
      InfluencerApplication.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
            allotted: { $sum: { $cond: [{ $in: ['$status', ['Brand Allotted', 'Opportunity Accepted', 'Opportunity Declined']] }, 1, 0] } },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'Opportunity Accepted'] }, 1, 0] } },
            declined: { $sum: { $cond: [{ $eq: ['$status', 'Opportunity Declined'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
            barterOnly: { $sum: { $cond: [{ $eq: ['$collabTypePreference', 'Barter'] }, 1, 0] } },
            paidOnly: { $sum: { $cond: [{ $eq: ['$collabTypePreference', 'Paid'] }, 1, 0] } },
            bothCollab: { $sum: { $cond: [{ $eq: ['$collabTypePreference', 'Both'] }, 1, 0] } }
          }
        }
      ])
    ]);

    const stats = statsData[0] || {
      total: 0,
      pending: 0,
      allotted: 0,
      accepted: 0,
      declined: 0,
      rejected: 0,
      barterOnly: 0,
      paidOnly: 0,
      bothCollab: 0
    };

    const enrichedItems = await enrichApplicationAllotments(items);

    return res.json({
      success: true,
      items: enrichedItems,
      totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      stats
    });
  } catch (error: any) {
    console.error('Error fetching influencer applications:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// Helper to render branded, mobile-responsive confirmation webpage for email Accept/Reject clicks
const renderOpportunityResponseHtml = (params: {
  success: boolean;
  isAccept?: boolean;
  title: string;
  message: string;
  brandName?: string;
  productName?: string;
  creatorName?: string;
  deliverables?: string;
  collabType?: string;
  managerName?: string;
  whatsappNumber?: string;
}) => {
  const {
    success,
    isAccept,
    title,
    message,
    brandName,
    productName,
    creatorName,
    deliverables,
    collabType,
    managerName
  } = params;

  const headerGradient = isAccept
    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
    : (success ? 'linear-gradient(135deg, #475569 0%, #64748b 100%)' : 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)');

  const iconSymbol = isAccept ? '&#10003;' : (success ? '&#10005;' : '!');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Ad2ship Creator Network</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .card {
      background: #ffffff;
      max-width: 520px;
      width: 100%;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.06);
      overflow: hidden;
    }
    .header {
      background: ${headerGradient};
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .icon-circle {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }
    .header h1 {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.2px;
      margin-bottom: 5px;
    }
    .header p {
      font-size: 13px;
      opacity: 0.92;
      font-weight: 400;
    }
    .body {
      padding: 28px 24px;
    }
    .message {
      font-size: 14.5px;
      line-height: 1.6;
      color: #475569;
      text-align: center;
      margin-bottom: 24px;
      font-weight: 400;
    }
    .message strong {
      font-weight: 600;
      color: #1e293b;
    }
    .info-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #64748b;
      font-weight: 400;
    }
    .info-val {
      color: #0f172a;
      font-weight: 500;
      text-align: right;
    }
    .next-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #166534;
      line-height: 1.5;
      font-weight: 400;
    }
    .next-box strong {
      font-weight: 600;
    }
    .btn-wrap {
      text-align: center;
      margin-top: 10px;
    }
    .footer {
      border-top: 1px solid #f1f5f9;
      padding: 16px 24px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      font-weight: 400;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon-circle">${iconSymbol}</div>
      <h1>${title}</h1>
      <p>Ad2ship Creator Network &bull; Official Campaign Response</p>
    </div>
    <div class="body">
      <div class="message">${message}</div>

      ${brandName ? `
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Allotted Brand</span>
          <span class="info-val" style="color: #4338ca; font-weight: 600;">${brandName}</span>
        </div>
        ${productName ? `
        <div class="info-row">
          <span class="info-label">Product</span>
          <span class="info-val" style="color: #0f172a; font-weight: 600;">${productName}</span>
        </div>` : ''}
        ${collabType ? `
        <div class="info-row">
          <span class="info-label">Collab Mode</span>
          <span class="info-val">${collabType}</span>
        </div>` : ''}
        ${deliverables ? `
        <div class="info-row">
          <span class="info-label">Deliverables</span>
          <span class="info-val">${deliverables}</span>
        </div>` : ''}
        ${managerName ? `
        <div class="info-row">
          <span class="info-label">Assigned Manager</span>
          <span class="info-val">${managerName}</span>
        </div>` : ''}
      </div>` : ''}

      ${isAccept ? `
      <div class="next-box">
        <strong>✨ What happens next:</strong><br>
        Our campaign management team has updated our live roster. Your assigned manager will connect with you to share the creative brief and coordinate package dispatch.
      </div>

      <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 20px;">
        <div style="font-family: 'Roboto', Arial, sans-serif; font-size: 13px; font-weight: 600; color: #6b21a8; margin-bottom: 4px;">
          ✨ Join Our Influencer Community
        </div>
        <div style="font-family: 'Roboto', Arial, sans-serif; font-size: 12px; color: #581c87; line-height: 1.5; margin-bottom: 12px; font-weight: 400;">
          Connect with fellow creators & receive early alerts for brand barter PR parcels and campaign briefs.
        </div>
        <a href="https://chat.whatsapp.com/LlDdZH5vdXi2Pbb1wCAymU?s=cl&p=a&iam=2" target="_blank" style="display: inline-block; background-color: #7c3aed; color: #ffffff; text-decoration: none; font-family: 'Roboto', Arial, sans-serif; font-size: 12px; font-weight: 600; padding: 8px 20px; border-radius: 6px; letter-spacing: 0.2px;">
          Join Influencer Community on WhatsApp &rarr;
        </a>
      </div>` : ''}

      <div class="btn-wrap">
        <span style="font-size: 12px; color: #64748b;">You can safely close this browser window.</span>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Ad2ship Influencer Operations Hub. All rights reserved.
    </div>
  </div>
</body>
</html>`;
};

// ============================================================================
// 2b. PUBLIC ROUTE: Creator Responds to Brand Allotment (Accept / Reject Button)
// GET /api/v1/influencer-applications/respond
// ============================================================================
router.get('/respond', async (req: Request, res: Response) => {
  try {
    const { id, action, allotmentId } = req.query;

    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send(renderOpportunityResponseHtml({
        success: false,
        title: 'Invalid Link',
        message: 'The collaboration link appears to be invalid or incomplete. Please check the button in your email.'
      }));
    }

    const appItem = await InfluencerApplication.findById(id);
    if (!appItem || appItem.isDeleted) {
      return res.status(404).send(renderOpportunityResponseHtml({
        success: false,
        title: 'Invitation Not Found',
        message: 'This campaign allotment record could not be found or has been archived.'
      }));
    }

    const act = String(action || '').toLowerCase().trim();
    const isAccept = act === 'accept';
    const isReject = act === 'reject' || act === 'decline';

    if (!isAccept && !isReject) {
      return res.status(400).send(renderOpportunityResponseHtml({
        success: false,
        title: 'Unrecognized Action',
        message: 'Please click the Accept or Decline button directly in your email.',
        brandName: appItem.allottedBrandName,
        creatorName: appItem.fullName
      }));
    }

    const newStatus = isAccept ? 'Opportunity Accepted' : 'Opportunity Declined';
    let targetBrandName = appItem.allottedBrandName;
    let targetProductName = appItem.allottedProductName;
    let targetDeliverables = appItem.allottedDeliverables;
    let targetCollabType = appItem.allottedCollabType;
    let targetManagerName = appItem.allottedManagerName;
    let targetTrackingId: any = undefined;

    if (Array.isArray(appItem.allotmentHistory) && appItem.allotmentHistory.length > 0) {
      let targetIdx = appItem.allotmentHistory.length - 1;
      if (allotmentId && typeof allotmentId === 'string') {
        const foundIdx = appItem.allotmentHistory.findIndex((h: any) => String(h._id) === allotmentId);
        if (foundIdx >= 0) targetIdx = foundIdx;
      }
      const targetEntry = appItem.allotmentHistory[targetIdx];
      targetEntry.status = newStatus;
      targetEntry.respondedAt = new Date();
      if (isAccept && (!targetEntry.collabStatus || targetEntry.collabStatus === 'Pending')) {
        targetEntry.collabStatus = 'In Discussion';
      }
      targetBrandName = targetEntry.brandName || targetBrandName;
      targetProductName = targetEntry.productName || '';
      targetDeliverables = targetEntry.deliverables || targetDeliverables;
      targetCollabType = targetEntry.collabType || targetCollabType;
      targetManagerName = targetEntry.managerName || targetManagerName;
      targetTrackingId = targetEntry.trackingInfluencerId;

      if (targetIdx === appItem.allotmentHistory.length - 1) {
        appItem.status = newStatus;
        appItem.opportunityRespondedAt = new Date();
      }
    } else {
      appItem.status = newStatus;
      appItem.opportunityRespondedAt = new Date();
    }
    await appItem.save();

    console.log(`[Influencer Response] ${appItem.fullName} responded: ${newStatus} for brand '${targetBrandName}'${targetProductName ? ` (Product: ${targetProductName})` : ''}`);

    // Sync status with active Influencer tracking record if present
    if (isAccept) {
      try {
        const trackingFilter: any = targetTrackingId
          ? { _id: targetTrackingId, isDeleted: { $ne: true } }
          : {
              $or: [
                { influencerInstagramId: appItem.instagramHandle, brandName: targetBrandName },
                { phone: appItem.whatsappNumber, brandName: targetBrandName }
              ],
              isDeleted: { $ne: true },
              ...(targetProductName ? { productName: targetProductName } : {})
            };
        await Influencer.updateMany(
          trackingFilter,
          {
            $set: {
              status: 'In Discussion',
              deliverables: targetDeliverables || undefined
            }
          }
        );
      } catch (syncErr) {
        console.warn('Could not update active tracking record:', syncErr);
      }
    }

    return res.status(200).send(renderOpportunityResponseHtml({
      success: true,
      isAccept,
      title: isAccept ? 'Collaboration Confirmed! 🎉' : 'Opportunity Declined',
      message: isAccept
        ? `Thank you, <strong>${appItem.fullName}</strong>! Your campaign slot for <strong>${targetBrandName || 'the brand'}${targetProductName ? ` (${targetProductName})` : ''}</strong> is officially accepted and confirmed on our operations panel.`
        : `Thank you for letting us know, <strong>${appItem.fullName}</strong>. We have updated our campaign roster and our team will not contact you regarding this campaign.`,
      brandName: targetBrandName,
      productName: targetProductName,
      creatorName: appItem.fullName,
      deliverables: targetDeliverables,
      collabType: targetCollabType,
      managerName: targetManagerName,
      whatsappNumber: appItem.whatsappNumber
    }));
  } catch (error: any) {
    console.error('Error processing creator opportunity response:', error);
    return res.status(500).send(renderOpportunityResponseHtml({
      success: false,
      title: 'Server Error',
      message: 'An unexpected server error occurred while updating your status. Please contact your campaign manager.'
    }));
  }
});

// ============================================================================
// 3. PROTECTED ROUTE: Get Single Application
// GET /api/v1/influencer-applications/:id
// ============================================================================
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const item = await InfluencerApplication.findById(req.params.id).lean();
    if (!item || item.isDeleted) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    const [enriched] = await enrichApplicationAllotments([item]);
    return res.json({ success: true, item: enriched });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ============================================================================
// 4. PROTECTED ROUTE: Allot Brand to Influencer Application
// POST /api/v1/influencer-applications/:id/allot-brand
// ============================================================================
router.post('/:id/allot-brand', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      brandId,
      brandName,
      requirementId,
      productName,
      productLink,
      collabDescription,
      requirementsSummary,
      collabType,
      deliverables,
      commercialAmount,
      managerNotes,
      sendEmailNotification = true,
      addToActiveTracking = true
    } = req.body;

    if (!brandName || !brandName.trim()) {
      return res.status(400).json({ success: false, message: 'Brand name is required' });
    }
    if (!collabType || !['Barter', 'Paid', 'Both'].includes(collabType)) {
      return res.status(400).json({ success: false, message: 'Collaboration type must be Barter, Paid, or Both' });
    }

    const appItem = await InfluencerApplication.findById(id);
    if (!appItem || appItem.isDeleted) {
      return res.status(404).json({ success: false, message: 'Application record not found' });
    }

    // Resolve optional product-wise BrandRequirement brief
    let resolvedRequirement: any = null;
    if (requirementId && mongoose.Types.ObjectId.isValid(requirementId)) {
      resolvedRequirement = await BrandRequirement.findById(requirementId);
      if (resolvedRequirement && resolvedRequirement.isDeleted) {
        resolvedRequirement = null;
      }
    }

    const finalProductName = (productName !== undefined ? String(productName) : (resolvedRequirement?.productName || '')).trim();
    const finalProductLink = (productLink !== undefined ? String(productLink) : (resolvedRequirement?.productLink || '')).trim();
    const finalCollabDesc = (collabDescription !== undefined ? String(collabDescription) : (resolvedRequirement?.collabDescription || '')).trim();
    const finalReqSummary = (requirementsSummary !== undefined ? String(requirementsSummary) : (resolvedRequirement?.creatorRequirements || '')).trim();
    const finalRefVideoLink = (resolvedRequirement?.refVideoLink || '').trim();

    const managerName = req.user?.name || 'Campaign Operations Manager';
    const finalDeliverables = (deliverables || resolvedRequirement?.deliverables || '1 Dedicated Reel / Post + 1 Story').trim();
    const cleanComm = (collabType === 'Paid' || collabType === 'Both') ? (Number(commercialAmount) || 0) : 0;

    // Generate formatted WhatsApp message text
    const cleanPhone = formatCleanPhone(appItem.whatsappNumber);
    const commText = (collabType === 'Paid' || collabType === 'Both') && cleanComm > 0
      ? `• *Agreed Commercial:* ₹${cleanComm.toLocaleString('en-IN')}\n`
      : (collabType === 'Barter' ? '• *Collab Type:* Free PR Gifting / Barter Parcel\n' : '');

    const productText = finalProductName ? `• *Product:* ${finalProductName}\n` : '';
    const productLinkText = finalProductLink ? `• *Product Link:* ${finalProductLink}\n` : '';
    const briefText = finalCollabDesc ? `\n📋 *Collaboration Brief:* ${finalCollabDesc}\n` : '';

    const notesText = managerNotes && managerNotes.trim()
      ? `\n📝 *Special Guidelines:* ${managerNotes.trim()}\n`
      : '';

    const nextStepText = collabType === 'Both'
      ? '📦 *Next Step:* Our logistics team is preparing your PR parcel dispatch, and your campaign manager will share the creative brief & commercial payout details.'
      : (collabType === 'Barter'
        ? '📦 *Next Step:* Our logistics team is preparing your PR parcel dispatch to your delivery address.'
        : '🎬 *Next Step:* Your campaign manager will share the creative brief & script guidelines.');

    const whatsappMessage = `Hi ${appItem.fullName}! 🎉 Greetings from Ad2ship Influencer Operations!

Great news! We have reviewed your profile and you have been shortlisted & *allotted* for an exclusive influencer marketing collaboration with *${brandName.trim()}*${finalProductName ? ` for *${finalProductName}*` : ''}!

📌 *Campaign Particulars:*
• *Brand:* ${brandName.trim()}
${productText}${productLinkText}• *Collaboration:* ${collabType === 'Both' ? 'Barter + Paid' : `${collabType} Collab`}
• *Deliverables:* ${finalDeliverables}
${commText}• *Assigned Manager:* ${managerName}${briefText}${notesText}
${nextStepText}

👉 *Please reply to this WhatsApp message to confirm your availability & accept the collaboration!*`;

    // WhatsApp Click-to-Chat Link
    const whatsappShareUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;

    // Safely resolve Brand document and its ObjectId
    let resolvedBrandId: mongoose.Types.ObjectId | undefined = undefined;
    if (brandId && mongoose.Types.ObjectId.isValid(brandId)) {
      resolvedBrandId = new mongoose.Types.ObjectId(brandId);
    } else if (resolvedRequirement?.brandId) {
      resolvedBrandId = resolvedRequirement.brandId as mongoose.Types.ObjectId;
    } else {
      const foundBrand = await Brand.findOne({
        $or: [
          { brandName: brandName.trim() },
          ...(brandId ? [{ brandId: brandId }] : [])
        ]
      });
      if (foundBrand) {
        resolvedBrandId = foundBrand._id as mongoose.Types.ObjectId;
      }
    }

    // Preserve any legacy single allotment into history before appending the new brand/product allotment
    if (!Array.isArray(appItem.allotmentHistory)) {
      appItem.allotmentHistory = [];
    }
    if (appItem.allotmentHistory.length === 0 && appItem.allottedBrandName) {
      appItem.allotmentHistory.push({
        brandId: appItem.allottedBrandId,
        brandName: appItem.allottedBrandName,
        requirementId: appItem.allottedRequirementId,
        productName: appItem.allottedProductName || '',
        productLink: appItem.allottedProductLink || '',
        collabDescription: appItem.allottedCollabDescription || '',
        collabType: appItem.allottedCollabType || 'Barter',
        deliverables: appItem.allottedDeliverables || '',
        commercialAmount: appItem.allottedCommercial || 0,
        managerName: appItem.allottedManagerName || '',
        managerNotes: appItem.managerNotes || '',
        status: appItem.status || 'Brand Allotted',
        collabStatus: 'Pending',
        whatsappMessageText: appItem.whatsappMessageText || '',
        respondedAt: appItem.opportunityRespondedAt,
        allottedAt: appItem.allottedAt || appItem.createdAt
      });
    }

    // Optionally create or sync in Ad2ship Influencers table first so we can link trackingInfluencerId
    let syncedTrackingId: mongoose.Types.ObjectId | undefined = undefined;
    if (addToActiveTracking) {
      try {
        const dedupeOr = [
          { influencerInstagramId: appItem.instagramHandle, brandName: brandName.trim() },
          { phone: appItem.whatsappNumber, brandName: brandName.trim() }
        ];
        let existingQuery: any = { $or: dedupeOr, isDeleted: { $ne: true } };
        if (resolvedRequirement) {
          existingQuery.brandRequirementId = resolvedRequirement._id;
        } else if (finalProductName) {
          existingQuery.productName = finalProductName;
        } else {
          existingQuery.$and = [{ $or: [{ productName: '' }, { productName: { $exists: false } }] }];
        }

        const existingRecord = await Influencer.findOne(existingQuery);

        if (existingRecord) {
          syncedTrackingId = existingRecord._id as mongoose.Types.ObjectId;
        } else {
          const newInfluencer = new Influencer({
            brandName: brandName.trim(),
            brandId: resolvedBrandId,
            brandRequirementId: resolvedRequirement ? resolvedRequirement._id : undefined,
            productName: finalProductName,
            productLink: finalProductLink,
            videoDescription: finalCollabDesc,
            refVideoLink: finalRefVideoLink,
            influencerName: appItem.fullName,
            influencerInstagramId: appItem.instagramHandle,
            phone: appItem.whatsappNumber,
            profileLink: appItem.instagramUrl || `https://instagram.com/${appItem.instagramHandle.replace('@', '')}`,
            category: collabType === 'Paid' ? 'Paid' : (collabType === 'Barter' ? 'Barter' : 'Paid'),
            influencerManager: managerName,
            status: collabType === 'Barter' ? 'Pending' : 'In Discussion',
            influencerOnboardingAmt: cleanComm,
            connectedDate: new Date(),
            transactionDate: new Date(),
            notes: `Auto-allotted from WhatsApp application form${finalProductName ? ` (Product: ${finalProductName})` : ''}. Deliverables: ${finalDeliverables}. Manager: ${managerName}`
          });
          await newInfluencer.save();
          syncedTrackingId = newInfluencer._id as mongoose.Types.ObjectId;
        }
      } catch (syncErr) {
        console.warn('Could not auto-sync to Influencer tracking table:', syncErr);
      }
    }

    const newAllotmentId = new mongoose.Types.ObjectId();

    // Update latest application state (keeps full compatibility with table/filters)
    appItem.status = 'Brand Allotted';
    appItem.opportunityRespondedAt = undefined;
    appItem.allottedBrandId = resolvedBrandId;
    appItem.allottedBrandName = brandName.trim();
    appItem.allottedRequirementId = resolvedRequirement ? (resolvedRequirement._id as mongoose.Types.ObjectId) : undefined;
    appItem.allottedProductName = finalProductName;
    appItem.allottedProductLink = finalProductLink;
    appItem.allottedCollabDescription = finalCollabDesc;
    appItem.allottedRequirementsSummary = finalReqSummary;
    appItem.allottedCollabType = collabType;
    appItem.allottedDeliverables = finalDeliverables;
    appItem.allottedCommercial = cleanComm;
    appItem.allottedManagerId = req.user?._id;
    appItem.allottedManagerName = managerName;
    appItem.allottedAt = new Date();
    appItem.managerNotes = managerNotes ? managerNotes.trim() : '';
    appItem.whatsappMessageText = whatsappMessage;
    appItem.whatsappLastSentAt = new Date();
    appItem.emailNotificationStatus = sendEmailNotification && appItem.email ? 'Pending' : undefined;
    appItem.emailSentAt = sendEmailNotification && appItem.email ? new Date() : undefined;

    appItem.allotmentHistory.push({
      _id: newAllotmentId,
      brandId: resolvedBrandId,
      brandName: brandName.trim(),
      requirementId: resolvedRequirement ? (resolvedRequirement._id as mongoose.Types.ObjectId) : undefined,
      productName: finalProductName,
      productLink: finalProductLink,
      collabDescription: finalCollabDesc,
      collabType,
      deliverables: finalDeliverables,
      commercialAmount: cleanComm,
      managerName,
      managerNotes: managerNotes ? managerNotes.trim() : '',
      status: 'Brand Allotted',
      collabStatus: collabType === 'Barter' ? 'Pending' : 'In Discussion',
      trackingInfluencerId: syncedTrackingId,
      whatsappMessageText: whatsappMessage,
      allottedAt: new Date()
    });

    await appItem.save();

    // Auto-bump Open brief to In Progress once an influencer is allotted
    if (resolvedRequirement && resolvedRequirement.status === 'Open') {
      resolvedRequirement.status = 'In Progress';
      await resolvedRequirement.save().catch(() => {});
    }

    // Dynamically resolve public backend URL for Accept / Decline action buttons
    let detectedBaseUrl = (process.env.BACKEND_URL || process.env.API_URL || '').trim();
    if (!detectedBaseUrl || detectedBaseUrl.includes('localhost') || detectedBaseUrl.includes('127.0.0.1')) {
      const clientOrigin = req.body?.clientOrigin || req.headers.origin;
      if (clientOrigin && typeof clientOrigin === 'string' && !clientOrigin.includes('localhost')) {
        detectedBaseUrl = clientOrigin.replace(/\/$/, '');
      } else {
        const forwardedHost = (req.headers['x-forwarded-host'] as string) || req.get('host');
        const forwardedProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
        if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
          detectedBaseUrl = `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '');
        } else if (req.headers.referer) {
          try {
            const refUrl = new URL(req.headers.referer);
            if (!refUrl.host.includes('localhost') && !refUrl.host.includes('127.0.0.1')) {
              detectedBaseUrl = refUrl.origin.replace(/\/$/, '');
            }
          } catch (e) {}
        }
      }
    }

    if (!detectedBaseUrl || detectedBaseUrl.includes('localhost')) {
      // Default fallback for live environments
      detectedBaseUrl = 'https://media.ad2ship.com';
    }

    detectedBaseUrl = detectedBaseUrl.replace(/\/$/, '');
    const dynamicAcceptUrl = `${detectedBaseUrl}/api/v1/influencer-applications/respond?id=${appItem._id}&allotmentId=${newAllotmentId.toString()}&action=accept`;
    const dynamicRejectUrl = `${detectedBaseUrl}/api/v1/influencer-applications/respond?id=${appItem._id}&allotmentId=${newAllotmentId.toString()}&action=reject`;

    // Trigger Email Notification in background (non-blocking so API responds immediately)
    if (sendEmailNotification && appItem.email) {
      setImmediate(async () => {
        try {
          const emailSent = await sendBrandAllotmentEmail({
            applicationId: appItem._id.toString(),
            influencerEmail: appItem.email,
            influencerName: appItem.fullName,
            brandName: brandName.trim(),
            productName: finalProductName || undefined,
            productLink: finalProductLink || undefined,
            collabDescription: finalCollabDesc || undefined,
            collabType,
            deliverables: finalDeliverables,
            commercialAmount: cleanComm,
            managerName,
            notes: managerNotes ? managerNotes.trim() : '',
            influencerPhone: appItem.whatsappNumber,
            acceptUrl: dynamicAcceptUrl,
            rejectUrl: dynamicRejectUrl
          });

          await InfluencerApplication.findByIdAndUpdate(appItem._id, {
            emailNotificationStatus: emailSent ? 'Sent' : 'Failed',
            emailSentAt: new Date()
          });
        } catch (emailErr) {
          console.error('[Background Email Dispatch] Error sending brand allotment email:', emailErr);
          await InfluencerApplication.findByIdAndUpdate(appItem._id, {
            emailNotificationStatus: 'Failed'
          }).catch(() => {});
        }
      });
    }

    // Audit log
    await logActivity({
      userId: req.user?._id,
      userName: managerName,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      module: 'Influencer Onboarding',
      action: 'ALLOT_BRAND',
      entity: 'InfluencerApplication',
      entityId: appItem._id.toString(),
      details: `Allotted brand '${brandName.trim()}'${finalProductName ? ` [Product: ${finalProductName}]` : ''} (${collabType}) to influencer ${appItem.fullName}. Deliverables: ${finalDeliverables}`
    });

    const [enrichedApp] = await enrichApplicationAllotments([appItem.toObject()]);

    return res.json({
      success: true,
      message: `Brand '${brandName}'${finalProductName ? ` (${finalProductName})` : ''} allotted to ${appItem.fullName} successfully! Email dispatched and WhatsApp link generated.`,
      application: enrichedApp,
      whatsappMessage,
      whatsappShareUrl
    });
  } catch (error: any) {
    console.error('Error allotting brand to influencer application:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ============================================================================
// 5. PROTECTED ROUTE: Update Status (Reviewing / Rejected / Archived / Pending)
// PATCH /api/v1/influencer-applications/:id/status
// ============================================================================
router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, managerNotes } = req.body;
    const allowed = ['Pending', 'Reviewing', 'Brand Allotted', 'Opportunity Accepted', 'Opportunity Declined', 'Rejected', 'Archived'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const appItem = await InfluencerApplication.findById(req.params.id);
    if (!appItem || appItem.isDeleted) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    appItem.status = status;
    if (managerNotes !== undefined) {
      appItem.managerNotes = managerNotes;
    }
    await appItem.save();

    return res.json({
      success: true,
      message: `Status updated to ${status}`,
      application: appItem
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ============================================================================
// 5b. PROTECTED ROUTE: Update Specific Brand/Product Allotment Collab Status
// PATCH /api/v1/influencer-applications/:id/allotments/:allotmentId/status
// ============================================================================
router.patch('/:id/allotments/:allotmentId/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id, allotmentId } = req.params;
    const { collabStatus, status } = req.body;

    const appItem = await InfluencerApplication.findById(id);
    if (!appItem || appItem.isDeleted) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Ensure legacy single allotment is materialized in history if needed
    if ((!appItem.allotmentHistory || appItem.allotmentHistory.length === 0) && appItem.allottedBrandName) {
      appItem.allotmentHistory = [{
        brandId: appItem.allottedBrandId,
        brandName: appItem.allottedBrandName,
        requirementId: appItem.allottedRequirementId,
        productName: appItem.allottedProductName || '',
        productLink: appItem.allottedProductLink || '',
        collabDescription: appItem.allottedCollabDescription || '',
        collabType: appItem.allottedCollabType || 'Barter',
        deliverables: appItem.allottedDeliverables || '',
        commercialAmount: appItem.allottedCommercial || 0,
        managerName: appItem.allottedManagerName || '',
        managerNotes: appItem.managerNotes || '',
        status: appItem.status || 'Brand Allotted',
        collabStatus: 'Pending',
        whatsappMessageText: appItem.whatsappMessageText || '',
        respondedAt: appItem.opportunityRespondedAt,
        allottedAt: appItem.allottedAt || appItem.createdAt
      }];
    }

    let targetEntry: any = null;
    if (allotmentId === 'legacy-0' && appItem.allotmentHistory && appItem.allotmentHistory.length > 0) {
      targetEntry = appItem.allotmentHistory[0];
    } else if (appItem.allotmentHistory) {
      targetEntry = appItem.allotmentHistory.find((h: any) => String(h._id) === allotmentId);
    }

    if (!targetEntry) {
      return res.status(404).json({ success: false, message: 'Allotment entry not found' });
    }

    const allowedCollabStatuses = ['Pending', 'In Discussion', 'Parcel Sent', 'Under Review', 'Completed', 'Settled', 'Approved', 'Product Returned'];
    const allowedInviteStatuses = ['Brand Allotted', 'Opportunity Accepted', 'Opportunity Declined'];

    if (collabStatus && allowedCollabStatuses.includes(collabStatus)) {
      targetEntry.collabStatus = collabStatus;
      if (collabStatus === 'Parcel Sent') {
        targetEntry.parcelSentAt = targetEntry.parcelSentAt || new Date();
      } else if (collabStatus === 'Pending' || collabStatus === 'In Discussion') {
        targetEntry.parcelSentAt = undefined;
      }
      if (COMPLETED_STATUSES.has(collabStatus)) {
        targetEntry.completedAt = targetEntry.completedAt || new Date();
      }
    }

    if (status && allowedInviteStatuses.includes(status)) {
      targetEntry.status = status;
      targetEntry.respondedAt = new Date();
      const lastEntry = appItem.allotmentHistory![appItem.allotmentHistory!.length - 1];
      if (String(lastEntry._id) === String(targetEntry._id)) {
        appItem.status = status;
        appItem.opportunityRespondedAt = new Date();
      }
    }

    await appItem.save();

    // Sync execution collabStatus back to linked Influencer tracking record if found
    if (collabStatus && allowedCollabStatuses.includes(collabStatus)) {
      try {
        const trackingFilter: any = targetEntry.trackingInfluencerId
          ? { _id: targetEntry.trackingInfluencerId, isDeleted: { $ne: true } }
          : {
              $or: [
                { influencerInstagramId: appItem.instagramHandle, brandName: targetEntry.brandName },
                { phone: appItem.whatsappNumber, brandName: targetEntry.brandName }
              ],
              isDeleted: { $ne: true },
              ...(targetEntry.productName ? { productName: targetEntry.productName } : {})
            };

        const updateFields: any = { status: collabStatus, statusUpdatedAt: new Date() };
        if (collabStatus === 'Parcel Sent' && targetEntry.parcelSentAt) {
          updateFields.parcelSentAt = targetEntry.parcelSentAt;
        }
        if (COMPLETED_STATUSES.has(collabStatus)) {
          updateFields.completedAt = new Date();
        }
        await Influencer.updateMany(trackingFilter, { $set: updateFields });
      } catch (syncErr) {
        console.warn('Could not sync allotment status to Influencer tracking record:', syncErr);
      }
    }

    const [enriched] = await enrichApplicationAllotments([appItem.toObject()]);
    return res.json({
      success: true,
      message: 'Allotment status updated',
      application: enriched
    });
  } catch (error: any) {
    console.error('Error updating allotment status:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ============================================================================
// 6. PROTECTED ROUTE: Soft Delete Application
// DELETE /api/v1/influencer-applications/:id
// ============================================================================
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const appItem = await InfluencerApplication.findById(req.params.id);
    if (!appItem || appItem.isDeleted) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    appItem.isDeleted = true;
    appItem.deletedAt = new Date();
    appItem.deletedBy = req.user?._id;
    await appItem.save();

    return res.json({ success: true, message: 'Application removed successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

export default router;
