import { googleOAuthService } from '../integrations/google/googleOAuthService.js';
import { googleClientFactory } from '../integrations/google/googleClientFactory.js';
import { env } from '../config/env.js';
import { 
  ensureNexusWorkspace,
  searchFiles,
  readFile,
  createDocument,
  getDriveClient
} from '../integrations/google/googleDriveService.js';
import {
  listEvents,
  getEvent,
  findAvailability,
  createEvent
} from '../integrations/google/googleCalendarService.js';
import { supabaseAdmin } from '../config/supabase.js';

export async function startGoogleOAuth(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required to connect Google Workspace.' },
      });
    }

    const { authUrl } = await googleOAuthService.createAuthorizationUrl(userId);

    // If client requested JSON representation (e.g. from frontend SPA client)
    if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
      return res.status(200).json({
        success: true,
        data: { authUrl },
      });
    }

    // Direct browser redirect
    return res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
}

export async function handleGoogleOAuthCallback(req, res) {
  const { code, state, error } = req.query;
  const frontendBase = env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    console.warn('[Google OAuth Callback] Google returned error:', error);
    return res.redirect(`${frontendBase}/integrations?google=error&reason=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendBase}/integrations?google=error&reason=missing_parameters`);
  }

  try {
    await googleOAuthService.handleCallback(code, state);
    return res.redirect(`${frontendBase}/integrations?google=connected`);
  } catch (err) {
    console.error('[Google OAuth Callback] Exchange failed:', err.message);
    const errorCode = err.code || 'oauth_exchange_failed';
    return res.redirect(`${frontendBase}/integrations?google=error&reason=${encodeURIComponent(errorCode)}`);
  }
}

export async function getGoogleStatus(req, res, next) {
  try {
    const userId = req.user?.id;
    const statusData = await googleOAuthService.getConnection(userId);

    return res.status(200).json({
      success: true,
      data: statusData,
    });
  } catch (err) {
    next(err);
  }
}

export async function testGoogleConnection(req, res, next) {
  try {
    const userId = req.user?.id;
    const result = await googleClientFactory.testGoogleConnection(userId);

    const statusCode = result.test === 'success' ? 200 : (result.status === 'reauthorization_required' ? 401 : 400);

    return res.status(statusCode).json({
      success: result.test === 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function disconnectGoogle(req, res, next) {
  try {
    const userId = req.user?.id;
    await googleOAuthService.disconnect(userId);

    return res.status(200).json({
      success: true,
      message: 'Google Workspace integration disconnected successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getDriveWorkspace(req, res, next) {
  try {
    const userId = req.user?.id;
    const connection = await googleOAuthService.getConnection(userId);
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Google not connected.' });
    }
    
    // Test Drive connectivity
    const drive = await getDriveClient(userId);

    let folderId = connection.metadata?.nexus_workspace_id;
    let webViewLink = folderId ? `https://drive.google.com/drive/folders/${folderId}` : null;

    if (!folderId) {
      const q = "name='NEXUS AI' and mimeType='application/vnd.google-apps.folder' and trashed=false";
      const resDrive = await drive.files.list({ q, spaces: 'drive', fields: 'files(id, name, webViewLink)' });
      if (resDrive.data.files && resDrive.data.files.length > 0) {
        folderId = resDrive.data.files[0].id;
        webViewLink = resDrive.data.files[0].webViewLink || `https://drive.google.com/drive/folders/${folderId}`;
        const metadata = { ...(connection.metadata || {}), nexus_workspace_id: folderId };
        await supabaseAdmin.from('google_connections').update({ metadata }).eq('user_id', userId);
      }
    }

    return res.status(200).json({
      success: true,
      workspaceCreated: !!folderId,
      folderId: folderId || null,
      webViewLink: webViewLink || null,
    });
  } catch (err) {
    next(err);
  }
}

export async function createDriveWorkspace(req, res, next) {
  try {
    const userId = req.user?.id;
    const result = await ensureNexusWorkspace(userId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function searchDriveFiles(req, res, next) {
  try {
    const userId = req.user?.id;
    const { q, limit, folderId, mimeType } = req.query;
    const files = await searchFiles(userId, { 
      query: q, 
      parentFolderId: folderId, 
      mimeType, 
      limit: limit ? parseInt(limit, 10) : 10 
    });
    return res.status(200).json({ success: true, files });
  } catch (err) {
    next(err);
  }
}

export async function getDriveFile(req, res, next) {
  try {
    const userId = req.user?.id;
    const { fileId } = req.params;
    const result = await readFile(userId, fileId);
    return res.status(200).json({ success: true, file: result });
  } catch (err) {
    next(err);
  }
}

export async function createDriveDocument(req, res, next) {
  try {
    const userId = req.user?.id;
    const { name, content, folderId } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ success: false, error: 'Name and content required' });
    }
    
    const result = await createDocument(userId, name, content, folderId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCalendarEvents(req, res, next) {
  try {
    const userId = req.user?.id;
    const { calendarId, timeMin, timeMax, maxResults } = req.query;
    const events = await listEvents(userId, {
      calendarId,
      timeMin,
      timeMax,
      maxResults: maxResults ? parseInt(maxResults, 10) : 20
    });
    return res.status(200).json({ success: true, events });
  } catch (err) {
    next(err);
  }
}

export async function getCalendarEvent(req, res, next) {
  try {
    const userId = req.user?.id;
    const { eventId } = req.params;
    const { calendarId } = req.query;
    const event = await getEvent(userId, eventId, calendarId);
    return res.status(200).json({ success: true, event });
  } catch (err) {
    next(err);
  }
}

export async function getCalendarAvailability(req, res, next) {
  try {
    const userId = req.user?.id;
    // can receive as GET query params (comma separated string) or POST depending on how we expose it. We'll support query for GET.
    const { calendarIds, timeMin, timeMax, durationMinutes, timezone } = req.query;
    
    if (!calendarIds || !timeMin || !timeMax || !durationMinutes) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    const cals = calendarIds.split(',');
    const duration = parseInt(durationMinutes, 10);

    const availability = await findAvailability(userId, {
      calendarIds: cals,
      timeMin,
      timeMax,
      durationMinutes: duration,
      timezone
    });

    return res.status(200).json({ success: true, availability });
  } catch (err) {
    next(err);
  }
}

export async function createCalendarEventHandler(req, res, next) {
  try {
    const userId = req.user?.id;
    const { calendarId, summary, description, start, end, timeZone, attendees, location } = req.body;
    
    if (!summary || !start || !end) {
      return res.status(400).json({ success: false, error: 'summary, start, and end are required' });
    }

    const event = await createEvent(userId, {
      calendarId, summary, description, start, end, timeZone, attendees, location
    });
    return res.status(200).json({ success: true, event });
  } catch (err) {
    next(err);
  }
}

export const googleIntegrationController = {
  startGoogleOAuth,
  handleGoogleOAuthCallback,
  getGoogleStatus,
  testGoogleConnection,
  disconnectGoogle,
  getDriveWorkspace,
  createDriveWorkspace,
  searchDriveFiles,
  getDriveFile,
  createDriveDocument,
  getCalendarEvents,
  getCalendarEvent,
  getCalendarAvailability,
  createCalendarEvent: createCalendarEventHandler,
};

