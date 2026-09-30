import { googleOAuthService } from '../integrations/google/googleOAuthService.js';
import { googleClientFactory } from '../integrations/google/googleClientFactory.js';
import { env } from '../config/env.js';

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

export const googleIntegrationController = {
  startGoogleOAuth,
  handleGoogleOAuthCallback,
  getGoogleStatus,
  testGoogleConnection,
  disconnectGoogle,
};
