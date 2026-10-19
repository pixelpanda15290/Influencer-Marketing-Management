import { Influencer, Brand, Target, GoogleSheetConfig, User, Employee } from '../models/allModels';
import { getCanonicalManagerName } from '../routes/influencerRoutes';
import axios from 'axios';
import { google } from 'googleapis';
import dns from 'dns';
import https from 'https';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const httpsAgent = new https.Agent({
  family: 4, // Force IPv4 to prevent IPv6 connection timeouts
  keepAlive: true,
  timeout: 30000
});

// Helper to parse dates (e.g. "8/4/2026", "2026-08-04", etc.)
function parseSheetDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const str = String(val).trim();
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/.test(str)) {
    const parts = str.split(/[\/\-\.]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2].slice(0, 4), 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }
  const parsed = new Date(str);
  return !isNaN(parsed.getTime()) ? parsed : new Date();
}

// Helper to parse "recieved by rahul", "done by rahul", "received by X", "paid by Y" from REMARK/ACCOUNT OWNER NAME column
function parseAccountOwnerDetails(remark: string, inAmt: number = 0, outAmt: number = 0) {
  let moneyReceivedBy = '';
  let paymentDoneBy = '';

  if (!remark) return { moneyReceivedBy, paymentDoneBy };

  const recMatch = remark.match(/(?:recieved|received|got|in)\s+(?:by\s+)?([a-zA-Z0-9_\s.]+)/i);
  const doneMatch = remark.match(/(?:done|paid|given|out|transferred)\s+(?:by\s+)?([a-zA-Z0-9_\s.]+)/i);

  if (recMatch && recMatch[1]) {
    moneyReceivedBy = recMatch[1].trim();
  }
  if (doneMatch && doneMatch[1]) {
    paymentDoneBy = doneMatch[1].trim();
  }

  if (!moneyReceivedBy && !paymentDoneBy) {
    const clean = remark.replace(/^(?:recieved|received|done|paid)\s+by\s+/i, '').replace(/^by\s+/i, '').trim();
    if (clean.length > 0 && clean.length < 30) {
      if (inAmt > 0 || remark.toLowerCase().includes('recie') || remark.toLowerCase().includes('receiv')) {
        moneyReceivedBy = clean;
      }
      if (outAmt > 0 || remark.toLowerCase().includes('done') || remark.toLowerCase().includes('paid')) {
        paymentDoneBy = clean;
      }
    }
  }

  return { moneyReceivedBy, paymentDoneBy };
}

// Helper to parse CSV string into array of objects
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length === 0) continue;
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const cleanHeader = h.trim().replace(/^"|"$/g, '');
      const cellVal = row[idx] ? row[idx].trim().replace(/^"|"$/g, '') : '';
      record[cleanHeader] = cellVal;
    });
    records.push(record);
  }

  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Core function to insert / upsert Barter records from row objects
export async function processBarterRows(rows: Record<string, string>[], currentSheetId: string = ''): Promise<number> {
  let syncedCount = 0;
  const syncedDocIds: any[] = [];

  // Fetch all registered users and employees to validate Assignee against database
  const registeredUsers = await User.find({}, 'name email').lean();
  const registeredEmployees = await Employee.find({}, 'name email').lean();
  
  const validMemberNames = Array.from(new Set([
    ...registeredUsers.map(u => (u.name || '').trim()),
    ...registeredEmployees.map(e => (e.name || '').trim())
  ])).filter(name => name.length > 0);

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    // Extract column values matching sheet headers case-insensitively
    const getCol = (...names: string[]) => {
      for (const n of names) {
        const key = Object.keys(row).find(k => k.trim().toLowerCase() === n.toLowerCase());
        if (key && row[key] && typeof row[key] !== 'object' && String(row[key]).trim().length > 0) return String(row[key]).trim();
      }
      return '';
    };

    const rowDateStr = getCol('Column 1', 'Date', 'Order date', 'Order Date', 'Transaction Date', 'DATE') || '';
    const brandName = getCol('BRAND NAME', 'Brand Name', 'BRAND', 'Brand');
    const rawInfName = getCol('Influencers id', 'INFLUENCERS NAME / Instagram ID', 'Influencer Name', 'Influencer', 'INFLUENCERS NAME', 'Instagram ID', 'Influencers ID');
    const rawAssignee = getCol('Assigne', 'Assignee', 'Assigned To');
    const rawManager = getCol('BRAND MANAGER', 'Brand Manager', 'Manager Name', 'Manager');
    const rawTeam = getCol('Brand Manager Team', 'Manager Team', 'Team');
    const categoryCol = getCol('Collab Type', 'Column 20', 'Category', 'TYPE', 'Type') || '';
    const productLink = getCol('PRODUCT LINK', 'Product Link', 'Product link') || '';
    const videoType = getCol('Type of Video', 'Type Of Video', 'Video Type') || 'Single Product Video';
    const videoDescription = getCol('video description', 'Video Description') || '';
    const refVideoLink = getCol('ReferanceVideo Link', 'Referance Video Link', 'REFRENCE VIDEO LINK', 'Reference Video Link', 'Ref Link') || '';
    const orderId = getCol('Order ID', 'OrderID', 'Order Id') || '';

    // Skip empty rows that have neither brandName, influencer name, orderId, productLink, nor videoDescription
    if (!brandName && !rawInfName && !orderId && !productLink && !videoDescription) continue;

    // Strict Employee / Panel Member Assignee Matching:
    // Only registered panel members (Users / Employees) can be set as Assignee
    let matchedMemberName = '';
    const candidateNames = [rawAssignee, rawManager, rawTeam].filter(Boolean);
    for (const cand of candidateNames) {
      const cleanCand = cand.trim().toLowerCase();
      if (cleanCand === 'mouli' || cleanCand === 'maouli' || cleanCand === 'mouli pandey' || cleanCand === 'maouli pandey') {
        matchedMemberName = 'Mouli Pandey';
        break;
      }
      const match = validMemberNames.find(m => {
        const lowM = m.toLowerCase();
        return lowM === cleanCand || lowM.split(' ')[0] === cleanCand || cleanCand.split(' ')[0] === lowM;
      });
      if (match) {
        matchedMemberName = getCanonicalManagerName(match);
        break;
      }
    }

    const managerName = matchedMemberName ? getCanonicalManagerName(matchedMemberName) : '';
    const brandManager = rawManager || rawTeam || '';

    const finalInfName = rawInfName || '';
    const contentLink = getCol('CONTENT LINK', 'Content Link') || '';
    const adsCode = getCol('ADS CODE', 'Ads Code') || '';
    const approvalRaw = getCol('Approved or not', 'Approved Or Not', 'Approval Status') || '';
    const reason = getCol('Reason', 'REASON', 'Remarks') || '';
    const remarkRaw = getCol('REMARK/ACCOUNT OWNER NAME', 'REMARK / ACCOUNT OWNER NAME', 'Account Owner Name', 'REMARK', 'Remark', 'Remarks') || '';
    const inAmtRaw = Number(getCol('IN', 'In', 'Brand Price', 'Brand Onboarding')) || 0;
    const outAmtRaw = Number(getCol('OUT', 'Out', 'Creator Cost', 'Influencer Price')) || 0;

    const { moneyReceivedBy, paymentDoneBy } = parseAccountOwnerDetails(remarkRaw, inAmtRaw, outAmtRaw);

    // Clean influencer name & handle (strictly keep blank if it is a website, product URL, or non-instagram link)
    const { name: cleanInfName, handle: instaId, link: profileLinkVal } = sanitizeInfluencerAndHandle(finalInfName);

    const parsedRowDate = rowDateStr ? parseSheetDate(rowDateStr) : undefined;
    const transactionDate = parsedRowDate || new Date();

    // Determine approval status
    let approvalStatus: 'Approved' | 'Not Approved' | 'Pending' = 'Pending';
    if (approvalRaw.toLowerCase().includes('yes') || approvalRaw.toLowerCase().includes('approved') || approvalRaw.toLowerCase() === 'true') {
      approvalStatus = 'Approved';
    } else if (approvalRaw.toLowerCase().includes('no') || approvalRaw.toLowerCase().includes('not')) {
      approvalStatus = 'Not Approved';
    }

    // Map status
    const statusRaw = getCol('STATUS', 'Status') || '';
    let finalStatus: 'Pending' | 'In Discussion' | 'Parcel Sent' | 'Under Review' | 'Completed' | 'Settled' | 'Approved' | 'Product Returned' = 'Pending';
    const lowerStat = statusRaw.toLowerCase();
    if (lowerStat.includes('completed') || lowerStat.includes('done')) finalStatus = 'Completed';
    else if (lowerStat.includes('approved')) finalStatus = 'Approved';
    else if (lowerStat.includes('settle')) finalStatus = 'Settled';
    else if (lowerStat.includes('return')) finalStatus = 'Product Returned';
    else if (lowerStat.includes('review')) finalStatus = 'Under Review';
    else if (lowerStat.includes('parcel') || lowerStat.includes('sent') || lowerStat.includes('dispatch')) finalStatus = 'Parcel Sent';
    else if (lowerStat.includes('discuss') || lowerStat.includes('talk') || lowerStat.includes('connect')) finalStatus = 'In Discussion';

    let existing: any = null;
    if (currentSheetId) {
      existing = await Influencer.findOne({ category: 'Barter', googleSheetId: currentSheetId, sheetRowIndex: idx });
    }
    if (!existing) {
      existing = await Influencer.findOne({ category: 'Barter', sheetRowIndex: idx });
    }
    if (!existing && orderId && !orderId.toLowerCase().includes('directly')) {
      existing = await Influencer.findOne({ category: 'Barter', orderId, brandName });
    }

    if (existing) {
      // 1. Preserve Brand Name: only update if sheet has brandName and existing is empty
      if (brandName && (!existing.brandName || existing.brandName.trim() === '')) {
        existing.brandName = brandName;
      }

      // 2. PRESERVE INFLUENCER NAME:
      // If team member entered an influencer name in the CRM, NEVER overwrite or clear it!
      // Only set from sheet if sheet actually has a valid creator name and existing is blank/placeholder
      if (cleanInfName && cleanInfName !== '—' && (!existing.influencerName || existing.influencerName === '—' || existing.influencerName.trim() === '')) {
        existing.influencerName = cleanInfName;
      }

      // 3. PRESERVE INSTAGRAM HANDLE & PROFILE LINK:
      if (instaId && (!existing.influencerInstagramId || existing.influencerInstagramId.trim() === '')) {
        existing.influencerInstagramId = instaId;
      }
      if (profileLinkVal && (!existing.profileLink || existing.profileLink.trim() === '')) {
        existing.profileLink = profileLinkVal;
      }

      // 4. PRESERVE ASSIGNEE / MANAGERS:
      if (managerName && (!existing.influencerManager || existing.influencerManager.trim() === '')) {
        existing.influencerManager = managerName;
      }
      if (brandManager && (!existing.brandManagerTeam || existing.brandManagerTeam.trim() === '')) {
        existing.brandManagerTeam = brandManager;
      }

      // 5. PRESERVE PRODUCT LINK & DELIVERABLES:
      if (productLink && (!existing.productLink || existing.productLink.trim() === '')) {
        existing.productLink = productLink;
      }
      if (videoType && (!existing.videoType || existing.videoType === 'Single Product Video')) {
        existing.videoType = videoType;
      }
      if (videoDescription && (!existing.videoDescription || existing.videoDescription.trim() === '')) {
        existing.videoDescription = videoDescription;
      }
      if (refVideoLink && (!existing.refVideoLink || existing.refVideoLink.trim() === '')) {
        existing.refVideoLink = refVideoLink;
      }
      if (orderId && (!existing.orderId || existing.orderId.trim() === '')) {
        existing.orderId = orderId;
      }
      if (orderId && parsedRowDate && !existing.orderDate) {
        existing.orderDate = parsedRowDate;
      }

      // 6. NEVER RESET VIEWS OR ORDERS THAT THE TEAM TRACKED:
      if (existing.viewsCount === undefined || existing.viewsCount === null) {
        existing.viewsCount = 0;
      }
      if (existing.ordersCount === undefined || existing.ordersCount === null) {
        existing.ordersCount = 0;
      }
      if (existing.ordersGenerated === undefined || existing.ordersGenerated === null) {
        existing.ordersGenerated = 0;
      }

      if (currentSheetId) existing.googleSheetId = currentSheetId;
      if (parsedRowDate && !existing.transactionDate) existing.transactionDate = parsedRowDate;

      // 7. PRESERVE LIVE STATUS UPDATED BY TEAM:
      // If team member already changed status to In Discussion, Parcel Sent, Under Review, Completed, Settled, etc., KEEP IT!
      if (finalStatus === 'Completed' || finalStatus === 'Approved') {
        existing.status = finalStatus;
        existing.isApproved = true;
        if (!existing.completedAt) {
          existing.completedAt = existing.updatedAt || new Date();
        }
      } else if (!existing.status || existing.status === 'Pending') {
        if (finalStatus && finalStatus !== 'Pending') {
          existing.status = finalStatus;
        }
      }

      // 8. PRESERVE CONTENT LINKS, ADS CODE, AND REMARKS:
      if (contentLink && (!existing.contentLink || existing.contentLink.trim() === '')) {
        existing.contentLink = contentLink;
      }
      if (adsCode && (!existing.adsCode || existing.adsCode.trim() === '')) {
        existing.adsCode = adsCode;
      }
      if (reason && (!existing.reason || existing.reason.trim() === '')) {
        existing.reason = reason;
      }
      if (moneyReceivedBy && (!existing.moneyReceivedBy || existing.moneyReceivedBy.trim() === '')) {
        existing.moneyReceivedBy = moneyReceivedBy;
      }
      if (paymentDoneBy && (!existing.paymentDoneBy || existing.paymentDoneBy.trim() === '')) {
        existing.paymentDoneBy = paymentDoneBy;
      }
      if (remarkRaw && (!existing.remark || existing.remark.trim() === '')) {
        existing.remark = remarkRaw;
      }
      existing.sheetRowIndex = idx;

      await existing.save();
      syncedDocIds.push(existing._id);
      syncedCount++;
    } else {
      const count = await Influencer.countDocuments();
      const created = await Influencer.create({
        sNo: count + 1,
        transactionDate,
        connectedDate: transactionDate,
        category: 'Barter',
        brandName,
        influencerName: cleanInfName,
        influencerInstagramId: instaId,
        profileLink: profileLinkVal,
        influencerManager: managerName,
        brandManagerTeam: brandManager,
        productLink,
        videoType,
        videoDescription,
        refVideoLink,
        orderId,
        orderDate: orderId && parsedRowDate ? parsedRowDate : undefined,
        status: finalStatus,
        completedAt: (finalStatus === 'Completed' || finalStatus === 'Approved') ? new Date() : undefined,
        parcelSentAt: finalStatus === 'Parcel Sent' ? new Date() : undefined,
        underReviewAt: finalStatus === 'Under Review' ? new Date() : undefined,
        inDiscussionAt: finalStatus === 'In Discussion' ? new Date() : undefined,
        statusUpdatedAt: new Date(),
        contentLink,
        adsCode,
        approvalStatus,
        isApproved: approvalStatus === 'Approved' || finalStatus === 'Completed',
        reason,
        moneyReceivedBy,
        paymentDoneBy,
        remark: remarkRaw,
        sheetRowIndex: idx,
        googleSheetId: currentSheetId,
        viewsCount: 0,
        ordersCount: 0,
        ordersGenerated: 0,
        brandOnboardingAmt: 0,
        brandReceivedAmt: 0,
        brandPendingAmt: 0,
        influencerOnboardingAmt: 0,
        influencerPaidAmt: 0,
        influencerPendingAmt: 0,
        ad2shipMargin: 0,
        inAmount: 0,
        outAmount: 0,
        balance: 0
      });
      syncedDocIds.push(created._id);
      syncedCount++;
    }
  }

  // Scoped cleanup: Only remove stale rows belonging strictly to THIS specific Google Sheet ID
  // CRITICAL: NEVER delete any record that the team has updated or added details to!
  if (currentSheetId && syncedDocIds.length > 0) {
    await Influencer.deleteMany({
      category: 'Barter',
      googleSheetId: currentSheetId,
      _id: { $nin: syncedDocIds },
      $and: [
        { $or: [{ influencerName: { $exists: false } }, { influencerName: '' }, { influencerName: '—' }] },
        { $or: [{ status: { $exists: false } }, { status: 'Pending' }] },
        { $or: [{ contentLink: { $exists: false } }, { contentLink: '' }] },
        { $or: [{ adsCode: { $exists: false } }, { adsCode: '' }] }
      ]
    });
  }

  return syncedCount;
}

// Fetch Google Sheets API v4 using Service Account (For Private Sheets)
async function fetchViaServiceAccount(sheetId: string): Promise<Record<string, string>[]> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!serviceAccountEmail || !privateKey) return [];

  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'A1:Z500'
  });

  const valueRows = response.data.values;
  if (!valueRows || valueRows.length === 0) return [];

  const headers = valueRows[0].map(h => String(h).trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < valueRows.length; i++) {
    const rowValues = valueRows[i];
    if (!rowValues || rowValues.length === 0) continue;
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = rowValues[idx] ? String(rowValues[idx]).trim() : '';
    });
    records.push(record);
  }

  return records;
}

export async function syncBarterFromGoogleSheet(): Promise<{
  success: boolean;
  syncedCount: number;
  message: string;
}> {
  try {
    let config = await GoogleSheetConfig.findOne();
    const defaultUrl = process.env.GOOGLE_SHEET_BARTER_URL || process.env.GOOGLE_SCRIPT_URL || process.env.GOOGLE_SHEET_CSV_URL || '';

    if (!config) {
      config = await GoogleSheetConfig.create({
        sheetUrl: defaultUrl,
        autoSyncEnabled: true,
        syncIntervalSeconds: 60,
        lastSyncStatus: 'IDLE'
      });
    }

    const targetUrl = (config && config.sheetUrl && config.sheetUrl.trim().length > 10)
      ? config.sheetUrl.trim()
      : defaultUrl;

    if (!targetUrl || targetUrl.includes('AKfycbwNv3pDStT-kRQ4zlQ9bB0snEfxqgZ--6BNarou3RNR3KWY6qebp4Uq94jerw7_5xJHaw')) {
      config.lastSyncStatus = 'IDLE';
      config.lastSyncMessage = 'Waiting for new Google Sheet URL to be configured.';
      await config.save();
      return {
        success: false,
        syncedCount: 0,
        message: 'No active Google Sheet URL configured. Please provide the new sheet URL.'
      };
    }

    // Check if Google Service Account is configured in backend/.env for PRIVATE Sheets!
    const sheetIdMatch = targetUrl ? targetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/) : null;
    const extractedSheetId = sheetIdMatch ? sheetIdMatch[1] : (process.env.GOOGLE_SHEET_ID || '');

    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && extractedSheetId) {
      console.log(`[GoogleSheetSync] Using Google Service Account API v4 for Private Sheet (${extractedSheetId.slice(0, 8)}...)...`);
      const serviceAccountRows = await fetchViaServiceAccount(extractedSheetId);
      if (serviceAccountRows.length > 0) {
        const syncedCount = await processBarterRows(serviceAccountRows, extractedSheetId);
        config.lastSyncedAt = new Date();
        config.lastSyncedCount = syncedCount;
        config.lastSyncStatus = 'SUCCESS';
        config.lastSyncMessage = `Successfully synced ${syncedCount} private Barter records via Google Sheets API v4`;
        await config.save();
        return { success: true, syncedCount, message: config.lastSyncMessage };
      }
    }

    if (!targetUrl) {
      config.lastSyncStatus = 'ERROR';
      config.lastSyncMessage = 'No Google Sheet URL or Apps Script URL configured in settings or backend .env';
      await config.save();
      return {
        success: false,
        syncedCount: 0,
        message: 'No Google Sheet URL configured. Please add URL in settings or backend .env'
      };
    }

    let sheetId = '1efFGd5tlXCcqz-pS60Tz5jAkK70qttgd6OGUhi1TBdg';
    let fetchUrl = targetUrl;
    if (targetUrl.includes('docs.google.com/spreadsheets/d/')) {
      const matches = targetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (matches && matches[1]) {
        sheetId = matches[1];
        fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=0`;
      }
    }

    console.log(`[GoogleSheetSync] Fetching Barter data from URL (${fetchUrl.slice(0, 45)}...)...`);
    
    // Retry loop (up to 3 attempts with exponential backoff)
    let response: any = null;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await axios.get(fetchUrl, {
          timeout: 30000,
          maxRedirects: 10,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/csv, text/plain, */*'
          }
        });
        if (response && response.data) break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[GoogleSheetSync Attempt ${attempt}/3] Network latency warning: ${err.message}. Retrying...`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (!response || !response.data) {
      throw lastErr || new Error('Failed to fetch Google Sheet after 3 attempts');
    }

    const rawData = response.data;
    let rows: Record<string, string>[] = [];

    if (typeof rawData === 'string') {
      if (rawData.includes('<!DOCTYPE html') || rawData.includes('<html') || rawData.includes('google.com/accounts')) {
        throw new Error('Google returned a private login page. For PRIVATE sheets, please see solution options in the setup guide.');
      }
      rows = parseCSV(rawData);
    } else if (Array.isArray(rawData)) {
      rows = rawData;
    } else if (typeof rawData === 'object' && rawData !== null) {
      if (Array.isArray(rawData.data)) rows = rawData.data;
      else if (Array.isArray(rawData.rows)) rows = rawData.rows;
      else if (Array.isArray(rawData.items)) rows = rawData.items;
    }

    if (rows.length === 0) {
      config.lastSyncedAt = new Date();
      config.lastSyncStatus = 'SUCCESS';
      config.lastSyncMessage = 'Sync checked, 0 records found';
      await config.save();
      return { success: true, syncedCount: 0, message: 'Google Sheet checked (0 records)' };
    }

    const syncedCount = await processBarterRows(rows, sheetId);

    config.lastSyncedAt = new Date();
    config.lastSyncedCount = syncedCount;
    config.lastSyncStatus = 'SUCCESS';
    config.lastSyncMessage = `Successfully synced ${syncedCount} Barter records from Google Sheet`;
    await config.save();

    console.log(`[GoogleSheetSync] ${config.lastSyncMessage}`);
    return { success: true, syncedCount, message: config.lastSyncMessage };
  } catch (error: any) {
    console.error('[GoogleSheetSync Error]:', error.message || error);
    try {
      const config = await GoogleSheetConfig.findOne();
      if (config) {
        config.lastSyncStatus = 'ERROR';
        config.lastSyncMessage = error.message || 'Error fetching Google Sheet';
        await config.save();
      }
    } catch (e) {}

    return {
      success: false,
      syncedCount: 0,
      message: error.message || 'Failed to sync with Google Sheet'
    };
  }
}

function sanitizeInfluencerAndHandle(input: string) {
  if (!input) return { name: '', handle: '', link: '' };
  const raw = String(input).trim();
  if (!raw) return { name: '', handle: '', link: '' };

  const lower = raw.toLowerCase();

  // If it's a website URL, Shopify URL, product URL, or non-instagram link, keep completely blank
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('www.') || lower.startsWith('@http')) {
    if (!lower.includes('instagram.com/')) {
      return { name: '', handle: '', link: '' };
    }
  }

  // If it contains domain extensions or web paths without being Instagram
  if (lower.includes('.com') || lower.includes('.in') || lower.includes('.co') || lower.includes('.store') || lower.includes('.shop') || lower.includes('.org') || lower.includes('.net')) {
    if (!lower.includes('instagram.com/')) {
      return { name: '', handle: '', link: '' };
    }
  }

  // If it's a full Instagram URL e.g. https://www.instagram.com/creator_name/?...
  if (lower.includes('instagram.com/')) {
    const cleanUrl = raw.split('?')[0].split('#')[0];
    const parts = cleanUrl.split('/').filter(Boolean);
    const candidate = parts.pop() || '';
    if (candidate && candidate !== 'instagram.com' && candidate !== 'www.instagram.com' && candidate !== 'reel' && candidate !== 'p' && candidate !== 'reels') {
      const cleanHandle = candidate.replace(/^@/, '').replace(/\s+/g, '').trim();
      return {
        name: cleanHandle,
        handle: `@${cleanHandle}`,
        link: `https://instagram.com/${cleanHandle}`
      };
    }
    return { name: '', handle: '', link: '' };
  }

  // If raw string has slashes (like /path/to/page)
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
}

function parseInstagramHandle(urlOrText: any): string {
  return sanitizeInfluencerAndHandle(urlOrText).handle;
}
