import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { googleIntegrationController } from '../controllers/googleIntegrationController.js';

const router = Router();

/**
 * GET /api/integrations/google/status
 * Check Google Workspace connection status for the authenticated user
 */
router.get('/status', requireAuth, googleIntegrationController.getGoogleStatus);

/**
 * GET /api/integrations/google/start
 * Initiate Google OAuth authorization flow with CSRF state protection
 */
router.get('/start', requireAuth, googleIntegrationController.startGoogleOAuth);

/**
 * GET /api/integrations/google/callback
 * Google OAuth redirect callback (State maps to authenticated user_id)
 */
router.get('/callback', googleIntegrationController.handleGoogleOAuthCallback);

/**
 * GET /api/integrations/google/test
 * Perform a real Google API connectivity test with decrypted credentials
 */
router.get('/test', requireAuth, googleIntegrationController.testGoogleConnection);

/**
 * POST /api/integrations/google/disconnect
 * Disconnect Google Workspace integration and revoke credentials
 */
router.post('/disconnect', requireAuth, googleIntegrationController.disconnectGoogle);

// Google Drive Routes
router.get('/drive/workspace', requireAuth, googleIntegrationController.getDriveWorkspace);
router.post('/drive/workspace', requireAuth, googleIntegrationController.createDriveWorkspace);
router.get('/drive/files', requireAuth, googleIntegrationController.searchDriveFiles);
router.get('/drive/files/:fileId', requireAuth, googleIntegrationController.getDriveFile);
router.post('/drive/documents', requireAuth, googleIntegrationController.createDriveDocument);

// Google Calendar Routes
router.get('/calendar/events', requireAuth, googleIntegrationController.getCalendarEvents);
router.get('/calendar/events/:eventId', requireAuth, googleIntegrationController.getCalendarEvent);
router.get('/calendar/availability', requireAuth, googleIntegrationController.getCalendarAvailability);
router.post('/calendar/events', requireAuth, googleIntegrationController.createCalendarEvent);

export default router;
