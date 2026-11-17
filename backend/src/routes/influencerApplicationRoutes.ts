import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { InfluencerApplication, Brand, Influencer, User } from '../models/allModels';
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
      city,
      state,
      collabTypePreference,
      costPerReel,
      costPerStory,
      languages,
      shippingAddress,
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
        clothingSize: shippingAddress?.clothingSize?.trim() || '',
        shoeSize: shippingAddress?.shoeSize?.trim() || ''
      },
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
        { allottedBrandName: regex }
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
            allotted: { $sum: { $cond: [{ $eq: ['$status', 'Brand Allotted'] }, 1, 0] } },
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
      rejected: 0,
      barterOnly: 0,
      paidOnly: 0,
      bothCollab: 0
    };

    return res.json({
      success: true,
      items,
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

// ============================================================================
// 3. PROTECTED ROUTE: Get Single Application
// GET /api/v1/influencer-applications/:id
// ============================================================================
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const item = await InfluencerApplication.findById(req.params.id);
    if (!item || item.isDeleted) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    return res.json({ success: true, item });
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

    const managerName = req.user?.name || 'Campaign Operations Manager';
    const finalDeliverables = (deliverables || '1 Dedicated Reel / Post + 1 Story').trim();
    const cleanComm = (collabType === 'Paid' || collabType === 'Both') ? (Number(commercialAmount) || 0) : 0;

    // Generate formatted WhatsApp message text
    const cleanPhone = formatCleanPhone(appItem.whatsappNumber);
    const commText = (collabType === 'Paid' || collabType === 'Both') && cleanComm > 0
      ? `• *Agreed Commercial:* ₹${cleanComm.toLocaleString('en-IN')}\n`
      : (collabType === 'Barter' ? '• *Collab Type:* Free PR Gifting / Barter Parcel\n' : '');

    const notesText = managerNotes && managerNotes.trim()
      ? `\n📝 *Special Guidelines:* ${managerNotes.trim()}\n`
      : '';

    const nextStepText = collabType === 'Both'
      ? '📦 *Next Step:* Our logistics team is preparing your PR parcel dispatch, and your campaign manager will share the creative brief & commercial payout details.'
      : (collabType === 'Barter'
        ? '📦 *Next Step:* Our logistics team is preparing your PR parcel dispatch to your delivery address.'
        : '🎬 *Next Step:* Your campaign manager will share the creative brief & script guidelines.');

    const whatsappMessage = `Hi ${appItem.fullName}! 🎉 Greetings from Ad2ship Influencer Operations!

Great news! We have reviewed your profile and you have been shortlisted & *allotted* for an exclusive influencer marketing collaboration with *${brandName.trim()}*!

📌 *Campaign Particulars:*
• *Brand:* ${brandName.trim()}
• *Collaboration:* ${collabType === 'Both' ? 'Barter + Paid' : `${collabType} Collab`}
• *Deliverables:* ${finalDeliverables}
${commText}• *Assigned Manager:* ${managerName}${notesText}
${nextStepText}

👉 *Please reply to this WhatsApp message to confirm your availability & accept the collaboration!*`;

    // WhatsApp Click-to-Chat Link
    const whatsappShareUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;

    // Safely resolve Brand document and its ObjectId
    let resolvedBrandId: mongoose.Types.ObjectId | undefined = undefined;
    if (brandId && mongoose.Types.ObjectId.isValid(brandId)) {
      resolvedBrandId = new mongoose.Types.ObjectId(brandId);
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

    // Update application state
    appItem.status = 'Brand Allotted';
    appItem.allottedBrandId = resolvedBrandId;
    appItem.allottedBrandName = brandName.trim();
    appItem.allottedCollabType = collabType;
    appItem.allottedDeliverables = finalDeliverables;
    appItem.allottedCommercial = cleanComm;
    appItem.allottedManagerId = req.user?._id;
    appItem.allottedManagerName = managerName;
    appItem.allottedAt = new Date();
    appItem.managerNotes = managerNotes ? managerNotes.trim() : '';
    appItem.whatsappMessageText = whatsappMessage;
    appItem.whatsappLastSentAt = new Date();

    // Trigger Email Notification via Nodemailer
    if (sendEmailNotification && appItem.email) {
      try {
        const emailSent = await sendBrandAllotmentEmail({
          influencerEmail: appItem.email,
          influencerName: appItem.fullName,
          brandName: brandName.trim(),
          collabType,
          deliverables: finalDeliverables,
          commercialAmount: cleanComm,
          managerName,
          notes: managerNotes ? managerNotes.trim() : '',
          influencerPhone: appItem.whatsappNumber
        });

        appItem.emailNotificationStatus = emailSent ? 'Sent' : 'Failed';
        appItem.emailSentAt = new Date();
      } catch (emailErr) {
        console.error('Error sending brand allotment email:', emailErr);
        appItem.emailNotificationStatus = 'Failed';
      }
    }

    await appItem.save();

    // Optionally create or sync in Ad2ship Influencers table so it appears in daily tracking
    if (addToActiveTracking) {
      try {
        const existingRecord = await Influencer.findOne({
          $or: [
            { influencerInstagramId: appItem.instagramHandle, brandName: brandName.trim() },
            { phone: appItem.whatsappNumber, brandName: brandName.trim() }
          ],
          isDeleted: { $ne: true }
        });

        if (!existingRecord) {
          const newInfluencer = new Influencer({
            brandName: brandName.trim(),
            brandId: resolvedBrandId,
            influencerName: appItem.fullName,
            influencerInstagramId: appItem.instagramHandle,
            phone: appItem.whatsappNumber,
            profileLink: appItem.instagramUrl || `https://instagram.com/${appItem.instagramHandle.replace('@', '')}`,
            category: collabType,
            influencerManager: managerName,
            status: collabType === 'Barter' ? 'Pending' : 'In Progress',
            influencerOnboardingAmt: cleanComm,
            connectedDate: new Date(),
            transactionDate: new Date(),
            deliverables: finalDeliverables,
            notes: `Auto-allotted from WhatsApp application form. Manager: ${managerName}`
          });
          await newInfluencer.save();
        }
      } catch (syncErr) {
        console.warn('Could not auto-sync to Influencer tracking table:', syncErr);
      }
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
      details: `Allotted brand '${brandName.trim()}' (${collabType}) to influencer ${appItem.fullName}. Deliverables: ${finalDeliverables}`
    });

    return res.json({
      success: true,
      message: `Brand '${brandName}' allotted to ${appItem.fullName} successfully! Email dispatched and WhatsApp link generated.`,
      application: appItem,
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
    const allowed = ['Pending', 'Reviewing', 'Brand Allotted', 'Rejected', 'Archived'];
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
