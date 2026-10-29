import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { GoogleSheetConfig } from '../models/allModels';
import { syncBarterFromGoogleSheet } from '../services/googleSheetSyncService';

const router = Router();

// GET /api/v1/sync/status - Fetch Google Sheet sync status & health
router.get('/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    let config = await GoogleSheetConfig.findOne();
    if (!config) {
      const defaultUrl = process.env.GOOGLE_SHEET_BARTER_URL || process.env.GOOGLE_SHEET_CSV_URL || '';
      config = await GoogleSheetConfig.create({
        sheetUrl: defaultUrl,
        autoSyncEnabled: true,
        syncIntervalSeconds: 60,
        lastSyncStatus: 'IDLE'
      });
    }

    // Mask secret URL for security (only expose masked domain/sheet ID to client)
    let maskedUrl = '';
    const hasActiveUrl = !!(config.sheetUrl && config.sheetUrl.trim().length > 10);
    if (hasActiveUrl) {
      const matches = config.sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (matches && matches[1]) {
        maskedUrl = `https://docs.google.com/spreadsheets/d/${matches[1].slice(0, 8)}.../gviz`;
      } else {
        maskedUrl = 'Configured (Encrypted Backend URL)';
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        isConfigured: hasActiveUrl && config.autoSyncEnabled,
        maskedUrl,
        autoSyncEnabled: hasActiveUrl ? config.autoSyncEnabled : false,
        syncIntervalSeconds: config.syncIntervalSeconds,
        lastSyncedAt: config.lastSyncedAt,
        lastSyncedCount: config.lastSyncedCount,
        lastSyncStatus: config.lastSyncStatus,
        lastSyncMessage: config.lastSyncMessage
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Error fetching sync status', error: error.message });
  }
});

// POST /api/v1/sync/unlink - Disconnect and disable Google Sheet sync
router.post('/unlink', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    let config = await GoogleSheetConfig.findOne();
    if (!config) {
      config = new GoogleSheetConfig();
    }

    config.sheetUrl = '';
    config.sheetId = '';
    config.autoSyncEnabled = false;
    config.lastSyncStatus = 'IDLE';
    config.lastSyncMessage = 'Google Sheet has been unlinked.';
    config.updatedBy = req.user?._id;

    await config.save();

    return res.status(200).json({
      success: true,
      message: 'Google Sheet unlinked successfully. Automatic sync has been stopped.',
      data: {
        isConfigured: false,
        autoSyncEnabled: false
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Error unlinking Google Sheet', error: error.message });
  }
});

// POST /api/v1/sync/trigger - Trigger immediate sync with Google Sheet
router.post('/trigger', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const config = await GoogleSheetConfig.findOne();
    if (!config || !config.sheetUrl || config.sheetUrl.trim().length <= 10 || !config.autoSyncEnabled) {
      return res.status(400).json({
        success: false,
        syncedCount: 0,
        message: 'Google Sheet is currently unlinked. Please link a Google Sheet first.'
      });
    }

    const result = await syncBarterFromGoogleSheet();
    return res.status(200).json({
      success: result.success,
      syncedCount: result.syncedCount,
      message: result.message
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Error triggering Google Sheet sync', error: error.message });
  }
});

// POST /api/v1/sync/config - Configure Google Sheet URL & Sync Settings (Admin/Manager)
router.post('/config', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sheetUrl, autoSyncEnabled, syncIntervalSeconds } = req.body;

    let config = await GoogleSheetConfig.findOne();
    if (!config) {
      config = new GoogleSheetConfig();
    }

    if (sheetUrl !== undefined) config.sheetUrl = sheetUrl.trim();
    if (autoSyncEnabled !== undefined) config.autoSyncEnabled = !!autoSyncEnabled;
    if (syncIntervalSeconds !== undefined) config.syncIntervalSeconds = Math.max(10, Number(syncIntervalSeconds) || 60);
    config.updatedBy = req.user?._id;

    await config.save();

    // Trigger immediate sync with new config
    const syncRes = await syncBarterFromGoogleSheet();

    return res.status(200).json({
      success: true,
      message: 'Google Sheet sync configuration updated successfully',
      data: {
        autoSyncEnabled: config.autoSyncEnabled,
        syncIntervalSeconds: config.syncIntervalSeconds,
        syncResult: syncRes
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Error updating sync config', error: error.message });
  }
});

// POST /api/v1/sync/webhook - Real-time push webhook from Google Apps Script
router.post('/webhook', async (req: any, res: Response) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : (req.body?.rows || req.body?.data || []);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided in webhook body' });
    }

    const { processBarterRows } = require('../services/googleSheetSyncService');
    const syncedCount = await processBarterRows(rows);

    return res.status(200).json({
      success: true,
      syncedCount,
      message: `Webhook successfully processed ${syncedCount} Barter records`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Webhook processing error', error: error.message });
  }
});

export default router;
