import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { BrandRequirement, Brand, InfluencerApplication } from '../models/allModels';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logActivity } from '../middleware/auditLog';

const router = Router();

const generateRequirementCode = async (): Promise<string> => {
  const existing = await BrandRequirement.find({ requirementCode: /^REQ-\d+$/ }, { requirementCode: 1 }).lean();
  let maxNum = 100;
  existing.forEach((doc: any) => {
    const match = doc.requirementCode?.match(/^REQ-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });

  let nextNum = maxNum + 1;
  let code = `REQ-${nextNum}`;
  while (await BrandRequirement.exists({ requirementCode: code })) {
    nextNum++;
    code = `REQ-${nextNum}`;
  }
  return code;
};

const resolveBrandRef = async (brandId?: string, brandName?: string) => {
  if (brandId && mongoose.Types.ObjectId.isValid(brandId)) {
    const byId = await Brand.findById(brandId).lean();
    if (byId && !byId.isDeleted) {
      return {
        resolvedBrandId: byId._id as mongoose.Types.ObjectId,
        resolvedBrandName: byId.brandName
      };
    }
  }

  const trimmedName = (brandName || '').trim();
  if (trimmedName) {
    const escaped = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const byName = await Brand.findOne({
      brandName: new RegExp(`^${escaped}$`, 'i'),
      isDeleted: { $ne: true }
    }).lean();
    if (byName) {
      return {
        resolvedBrandId: byName._id as mongoose.Types.ObjectId,
        resolvedBrandName: byName.brandName
      };
    }
  }

  return {
    resolvedBrandId: undefined,
    resolvedBrandName: trimmedName
  };
};

// ============================================================================
// 1. PUBLIC ROUTE: Lightweight Brand List for Ad Buyer / Marketing Brief Form
// GET /api/v1/brand-requirements/public-brands
// ============================================================================
router.get('/public-brands', async (_req: Request, res: Response) => {
  try {
    const brands = await Brand.find({
      isDeleted: { $ne: true },
      status: { $ne: 'Inactive' }
    })
      .select('_id brandId brandName industry')
      .sort({ brandName: 1 })
      .lean();

    return res.json({ success: true, data: brands });
  } catch (error: any) {
    console.error('Error loading public brands for requirement form:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ============================================================================
// 2. PUBLIC ROUTE: Submit Brand Product Requirement (Ad Buyers & Marketing Form)
// POST /api/v1/brand-requirements/submit
// ============================================================================
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const {
      brandId,
      brandName,
      productName,
      productCategory,
      productLink,
      productMrp,
      collabType,
      budgetPerCreator,
      deliverables,
      collabDescription,
      creatorRequirements,
      targetFollowerTier,
      creatorsNeeded,
      refVideoLink,
      specialGuidelines,
      targetTimeline,
      submittedByName,
      submittedByTeam,
      submittedByEmail,
      submittedByPhone,
      source
    } = req.body;

    if (!brandName || !String(brandName).trim()) {
      return res.status(400).json({ success: false, message: 'Brand name is required' });
    }
    if (!collabDescription || !String(collabDescription).trim()) {
      return res.status(400).json({ success: false, message: 'Collaboration description is required' });
    }
    if (!submittedByName || !String(submittedByName).trim()) {
      return res.status(400).json({ success: false, message: 'Your name (Ad Buyer / Marketing member) is required' });
    }
    if (collabType && !['Barter', 'Paid', 'Both'].includes(collabType)) {
      return res.status(400).json({ success: false, message: 'Collab type must be Barter, Paid, or Both' });
    }

    const { resolvedBrandId, resolvedBrandName } = await resolveBrandRef(brandId, brandName);
    const requirementCode = await generateRequirementCode();

    const doc = new BrandRequirement({
      requirementCode,
      brandId: resolvedBrandId,
      brandName: resolvedBrandName || String(brandName).trim(),
      productName: productName ? String(productName).trim() : '',
      productCategory: productCategory ? String(productCategory).trim() : 'Fashion & Styling',
      productLink: productLink ? String(productLink).trim() : '',
      productMrp: Number(productMrp) || 0,
      collabType: collabType || 'Barter',
      budgetPerCreator: (collabType === 'Paid' || collabType === 'Both') ? (Number(budgetPerCreator) || 0) : 0,
      deliverables: deliverables ? String(deliverables).trim() : '',
      collabDescription: String(collabDescription).trim(),
      creatorRequirements: creatorRequirements ? String(creatorRequirements).trim() : '',
      targetFollowerTier: targetFollowerTier ? String(targetFollowerTier).trim() : 'Any',
      creatorsNeeded: Math.max(1, Number(creatorsNeeded) || 1),
      refVideoLink: refVideoLink ? String(refVideoLink).trim() : '',
      specialGuidelines: specialGuidelines ? String(specialGuidelines).trim() : '',
      targetTimeline: targetTimeline ? String(targetTimeline).trim() : '',
      submittedByName: String(submittedByName).trim(),
      submittedByTeam: submittedByTeam ? String(submittedByTeam).trim() : 'Ad Buyers',
      submittedByEmail: submittedByEmail ? String(submittedByEmail).trim().toLowerCase() : '',
      submittedByPhone: submittedByPhone ? String(submittedByPhone).trim() : '',
      status: 'Open',
      source: source || 'Ad Buyer & Marketing Brief Form'
    });

    await doc.save();

    console.log(`[Brand Product Requirement Saved] ${doc.requirementCode}: ${doc.brandName} - ${doc.productName} (by ${doc.submittedByName})`);

    return res.status(201).json({
      success: true,
      message: 'Brand product requirement submitted and saved to panel!',
      data: doc
    });
  } catch (error: any) {
    console.error('Error submitting brand product requirement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to save product requirement.'
    });
  }
});

// ============================================================================
// 3. PROTECTED ROUTE: List Brand Product Requirements
// GET /api/v1/brand-requirements
// ============================================================================
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      brandId,
      brandName,
      collabType,
      submittedByTeam,
      search,
      all,
      page = 1,
      limit = 20
    } = req.query;

    const filter: any = { isDeleted: { $ne: true } };

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (brandId && mongoose.Types.ObjectId.isValid(String(brandId))) {
      filter.brandId = new mongoose.Types.ObjectId(String(brandId));
    }
    if (brandName && String(brandName).trim() && brandName !== 'All') {
      const escaped = String(brandName).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.brandName = new RegExp(`^${escaped}$`, 'i');
    }
    if (collabType && collabType !== 'All') {
      filter.collabType = { $in: [collabType, 'Both'] };
    }
    if (submittedByTeam && submittedByTeam !== 'All') {
      filter.submittedByTeam = submittedByTeam;
    }
    if (search && String(search).trim()) {
      const q = String(search).trim();
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { requirementCode: regex },
        { brandName: regex },
        { productName: regex },
        { productCategory: regex },
        { collabDescription: regex },
        { creatorRequirements: regex },
        { submittedByName: regex },
        { submittedByTeam: regex }
      ];
    }

    const fetchAll = all === 'true';
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = fetchAll ? 500 : Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = fetchAll ? 0 : (pageNum - 1) * limitNum;

    const [items, totalCount, statsData, allotmentCounts] = await Promise.all([
      BrandRequirement.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      BrandRequirement.countDocuments(filter),
      BrandRequirement.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            open: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
            fulfilled: { $sum: { $cond: [{ $eq: ['$status', 'Fulfilled'] }, 1, 0] } },
            paused: { $sum: { $cond: [{ $eq: ['$status', 'Paused'] }, 1, 0] } },
            closed: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } },
            barter: { $sum: { $cond: [{ $eq: ['$collabType', 'Barter'] }, 1, 0] } },
            paid: { $sum: { $cond: [{ $eq: ['$collabType', 'Paid'] }, 1, 0] } },
            both: { $sum: { $cond: [{ $eq: ['$collabType', 'Both'] }, 1, 0] } }
          }
        }
      ]),
      InfluencerApplication.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $project: {
            entries: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$allotmentHistory', []] } }, 0] },
                '$allotmentHistory',
                {
                  $cond: [
                    { $ne: ['$allottedRequirementId', null] },
                    [{ requirementId: '$allottedRequirementId', status: '$status' }],
                    []
                  ]
                }
              ]
            }
          }
        },
        { $unwind: '$entries' },
        { $match: { 'entries.requirementId': { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$entries.requirementId',
            allottedCount: { $sum: 1 },
            acceptedCount: {
              $sum: { $cond: [{ $eq: ['$entries.status', 'Opportunity Accepted'] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    const countMap = new Map<string, { allottedCount: number; acceptedCount: number }>();
    allotmentCounts.forEach((c: any) => {
      if (c._id) {
        countMap.set(String(c._id), {
          allottedCount: c.allottedCount || 0,
          acceptedCount: c.acceptedCount || 0
        });
      }
    });

    const enrichedItems = items.map((item: any) => {
      const counts = countMap.get(String(item._id)) || { allottedCount: 0, acceptedCount: 0 };
      return {
        ...item,
        allottedCount: counts.allottedCount,
        acceptedCount: counts.acceptedCount
      };
    });

    const stats = statsData[0] || {
      total: 0,
      open: 0,
      inProgress: 0,
      fulfilled: 0,
      paused: 0,
      closed: 0,
      barter: 0,
      paid: 0,
      both: 0
    };

    return res.json({
      success: true,
      items: enrichedItems,
      totalCount,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(totalCount / limitNum)),
      stats
    });
  } catch (error: any) {
    console.error('Error fetching brand requirements:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ============================================================================
// 4. PROTECTED ROUTE: Get Single Requirement with Allotted Influencers
// GET /api/v1/brand-requirements/:id
// ============================================================================
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const item = await BrandRequirement.findById(req.params.id).lean();
    if (!item || item.isDeleted) {
      return res.status(404).json({ success: false, message: 'Product requirement not found' });
    }

    const rawApps = await InfluencerApplication.find({
      isDeleted: { $ne: true },
      $or: [
        { allottedRequirementId: item._id },
        { 'allotmentHistory.requirementId': item._id }
      ]
    })
      .select('fullName instagramHandle whatsappNumber email city followersCountBracket status allottedCollabType allottedDeliverables allottedCommercial allottedAt allotmentHistory')
      .sort({ allottedAt: -1 })
      .lean();

    const allottedCreators = rawApps.map((app: any) => {
      const histMatch = Array.isArray(app.allotmentHistory)
        ? [...app.allotmentHistory].reverse().find((h: any) => String(h.requirementId) === String(item._id))
        : null;
      return {
        _id: app._id,
        fullName: app.fullName,
        instagramHandle: app.instagramHandle,
        whatsappNumber: app.whatsappNumber,
        email: app.email,
        city: app.city,
        followersCountBracket: app.followersCountBracket,
        status: histMatch?.status || app.status,
        collabStatus: histMatch?.collabStatus || 'Pending',
        allottedCollabType: histMatch?.collabType || app.allottedCollabType,
        allottedDeliverables: histMatch?.deliverables || app.allottedDeliverables,
        allottedCommercial: histMatch?.commercialAmount ?? app.allottedCommercial,
        allottedAt: histMatch?.allottedAt || app.allottedAt
      };
    });

    return res.json({
      success: true,
      item,
      allottedCreators
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ============================================================================
// 5. PROTECTED ROUTE: Create Brand Product Requirement from Panel
// POST /api/v1/brand-requirements
// ============================================================================
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const {
      brandId,
      brandName,
      productName,
      productCategory,
      productLink,
      productMrp,
      collabType,
      budgetPerCreator,
      deliverables,
      collabDescription,
      creatorRequirements,
      targetFollowerTier,
      creatorsNeeded,
      refVideoLink,
      specialGuidelines,
      targetTimeline,
      submittedByName,
      submittedByTeam,
      submittedByEmail,
      submittedByPhone
    } = req.body;

    if (!brandName || !String(brandName).trim()) {
      return res.status(400).json({ success: false, message: 'Brand name is required' });
    }
    if (!collabDescription || !String(collabDescription).trim()) {
      return res.status(400).json({ success: false, message: 'Collaboration description is required' });
    }

    const { resolvedBrandId, resolvedBrandName } = await resolveBrandRef(brandId, brandName);
    const requirementCode = await generateRequirementCode();

    const doc = new BrandRequirement({
      requirementCode,
      brandId: resolvedBrandId,
      brandName: resolvedBrandName || String(brandName).trim(),
      productName: productName ? String(productName).trim() : '',
      productCategory: productCategory ? String(productCategory).trim() : 'Fashion & Styling',
      productLink: productLink ? String(productLink).trim() : '',
      productMrp: Number(productMrp) || 0,
      collabType: collabType || 'Barter',
      budgetPerCreator: (collabType === 'Paid' || collabType === 'Both') ? (Number(budgetPerCreator) || 0) : 0,
      deliverables: deliverables ? String(deliverables).trim() : '',
      collabDescription: String(collabDescription).trim(),
      creatorRequirements: creatorRequirements ? String(creatorRequirements).trim() : '',
      targetFollowerTier: targetFollowerTier ? String(targetFollowerTier).trim() : 'Any',
      creatorsNeeded: Math.max(1, Number(creatorsNeeded) || 1),
      refVideoLink: refVideoLink ? String(refVideoLink).trim() : '',
      specialGuidelines: specialGuidelines ? String(specialGuidelines).trim() : '',
      targetTimeline: targetTimeline ? String(targetTimeline).trim() : '',
      submittedByName: (submittedByName && String(submittedByName).trim()) || req.user?.name || 'Operations Team',
      submittedByTeam: submittedByTeam ? String(submittedByTeam).trim() : 'Marketing Team',
      submittedByEmail: submittedByEmail ? String(submittedByEmail).trim().toLowerCase() : (req.user?.email || ''),
      submittedByPhone: submittedByPhone ? String(submittedByPhone).trim() : '',
      status: 'Open',
      source: 'Panel Creation',
      createdBy: req.user?._id
    });

    await doc.save();

    await logActivity({
      userId: req.user?._id,
      userName: req.user?.name || 'System User',
      userEmail: req.user?.email,
      userRole: req.user?.role,
      module: 'Brand Product Briefs',
      action: 'CREATE_REQUIREMENT',
      entity: 'BrandRequirement',
      entityId: doc._id.toString(),
      details: `Created product brief ${doc.requirementCode} for ${doc.brandName} - ${doc.productName}`
    });

    return res.status(201).json({
      success: true,
      message: `Product brief ${doc.requirementCode} created successfully!`,
      item: doc
    });
  } catch (error: any) {
    console.error('Error creating brand requirement:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ============================================================================
// 6. PROTECTED ROUTE: Update Brand Product Requirement
// PUT /api/v1/brand-requirements/:id
// ============================================================================
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await BrandRequirement.findById(req.params.id);
    if (!doc || doc.isDeleted) {
      return res.status(404).json({ success: false, message: 'Product requirement not found' });
    }

    const {
      brandId,
      brandName,
      productName,
      productCategory,
      productLink,
      productMrp,
      collabType,
      budgetPerCreator,
      deliverables,
      collabDescription,
      creatorRequirements,
      targetFollowerTier,
      creatorsNeeded,
      refVideoLink,
      specialGuidelines,
      targetTimeline,
      submittedByName,
      submittedByTeam,
      submittedByEmail,
      submittedByPhone,
      status
    } = req.body;

    if (brandName && String(brandName).trim()) {
      const { resolvedBrandId, resolvedBrandName } = await resolveBrandRef(brandId, brandName);
      doc.brandId = resolvedBrandId;
      doc.brandName = resolvedBrandName || String(brandName).trim();
    }
    if (productName !== undefined) doc.productName = String(productName).trim();
    if (productCategory !== undefined) doc.productCategory = String(productCategory).trim();
    if (productLink !== undefined) doc.productLink = String(productLink).trim();
    if (productMrp !== undefined) doc.productMrp = Number(productMrp) || 0;
    if (collabType && ['Barter', 'Paid', 'Both'].includes(collabType)) {
      doc.collabType = collabType;
    }
    if (budgetPerCreator !== undefined) {
      doc.budgetPerCreator = (doc.collabType === 'Paid' || doc.collabType === 'Both') ? (Number(budgetPerCreator) || 0) : 0;
    }
    if (deliverables !== undefined) doc.deliverables = String(deliverables).trim();
    if (collabDescription !== undefined) doc.collabDescription = String(collabDescription).trim();
    if (creatorRequirements !== undefined) doc.creatorRequirements = String(creatorRequirements).trim();
    if (targetFollowerTier !== undefined) doc.targetFollowerTier = String(targetFollowerTier).trim();
    if (creatorsNeeded !== undefined) doc.creatorsNeeded = Math.max(1, Number(creatorsNeeded) || 1);
    if (refVideoLink !== undefined) doc.refVideoLink = String(refVideoLink).trim();
    if (specialGuidelines !== undefined) doc.specialGuidelines = String(specialGuidelines).trim();
    if (targetTimeline !== undefined) doc.targetTimeline = String(targetTimeline).trim();
    if (submittedByName !== undefined) doc.submittedByName = String(submittedByName).trim();
    if (submittedByTeam !== undefined) doc.submittedByTeam = String(submittedByTeam).trim();
    if (submittedByEmail !== undefined) doc.submittedByEmail = String(submittedByEmail).trim().toLowerCase();
    if (submittedByPhone !== undefined) doc.submittedByPhone = String(submittedByPhone).trim();
    if (status && ['Open', 'In Progress', 'Fulfilled', 'Paused', 'Closed'].includes(status)) {
      doc.status = status;
    }

    await doc.save();

    return res.json({
      success: true,
      message: 'Product requirement updated successfully!',
      item: doc
    });
  } catch (error: any) {
    console.error('Error updating brand requirement:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ============================================================================
// 7. PROTECTED ROUTE: Update Status
// PATCH /api/v1/brand-requirements/:id/status
// ============================================================================
router.patch('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const allowed = ['Open', 'In Progress', 'Fulfilled', 'Paused', 'Closed'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const doc = await BrandRequirement.findById(req.params.id);
    if (!doc || doc.isDeleted) {
      return res.status(404).json({ success: false, message: 'Product requirement not found' });
    }

    doc.status = status;
    await doc.save();

    return res.json({
      success: true,
      message: `Status updated to ${status}`,
      item: doc
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ============================================================================
// 8. PROTECTED ROUTE: Soft Delete Requirement
// DELETE /api/v1/brand-requirements/:id
// ============================================================================
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await BrandRequirement.findById(req.params.id);
    if (!doc || doc.isDeleted) {
      return res.status(404).json({ success: false, message: 'Product requirement not found' });
    }

    doc.isDeleted = true;
    doc.deletedAt = new Date();
    doc.deletedBy = req.user?._id;
    await doc.save();

    return res.json({ success: true, message: 'Product requirement removed successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

export default router;

