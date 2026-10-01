import { google } from 'googleapis';
import { createOAuth2Client } from './googleOAuthService.js';
import { encryptionService } from '../../services/encryptionService.js';
import { supabaseAdmin } from '../../config/supabase.js';

/**
 * Mark connection status as reauthorization_required
 */
export async function markReauthorizationRequired(userId, reason = 'Credentials invalid or revoked') {
  try {
    await supabaseAdmin
      .from('google_connections')
      .update({
        status: 'reauthorization_required',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    const { error: logErr } = await supabaseAdmin.from('activity_logs').insert({
      actor_type: 'system',
      actor_id: userId,
      action: 'google_reauthorization_required',
      description: `Google connection requires reauthorization: ${reason}`,
      metadata: { reason },
    });

    if (logErr) {
      console.warn('[Google Client Factory] Activity log error:', logErr.message);
    }
  } catch (err) {
    console.warn('[Google Client Factory] Failed to update reauthorization status:', err.message);
  }
}

/**
 * Retrieve an authenticated Google OAuth2 Client for a given NEXUS user.
 * Tokens are decrypted on-demand and kept only in memory.
 *
 * @param {string} userId - NEXUS user profile UUID
 * @returns {Promise<import('googleapis').Auth.OAuth2Client>}
 */
export async function getAuthenticatedGoogleClient(userId) {
  if (!userId) {
    const error = new Error('User ID is required to get authenticated Google client.');
    error.status = 400;
    error.code = 'USER_ID_REQUIRED';
    throw error;
  }

  // 1. Fetch encrypted connection record from Supabase
  const { data: connection, error: dbError } = await supabaseAdmin
    .from('google_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (dbError || !connection) {
    const error = new Error('No Google Workspace connection found for this user.');
    error.status = 404;
    error.code = 'GOOGLE_NOT_CONNECTED';
    throw error;
  }

  if (connection.status === 'disconnected') {
    const error = new Error('Google Workspace connection has been disconnected.');
    error.status = 400;
    error.code = 'GOOGLE_DISCONNECTED';
    throw error;
  }

  if (connection.status === 'reauthorization_required') {
    const error = new Error('Google Workspace connection expired or was revoked. Reauthorization required.');
    error.status = 401;
    error.code = 'GOOGLE_REAUTHORIZATION_REQUIRED';
    throw error;
  }

  // 2. Decrypt refresh token
  let refreshToken;
  try {
    refreshToken = encryptionService.decrypt(connection.refresh_token_encrypted);
  } catch (decryptErr) {
    console.error(`[Google Client Factory] Decryption failed for user ${userId}:`, decryptErr.message);
    await markReauthorizationRequired(userId, 'Decryption failure (corrupted token payload)');
    const error = new Error('Failed to decrypt stored Google credentials. Please reconnect Google Workspace.');
    error.status = 401;
    error.code = 'GOOGLE_CREDENTIAL_DECRYPT_FAILED';
    throw error;
  }

  // 3. Instantiate OAuth2 Client with refresh token
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

/**
 * Perform a real, safe Google API call to verify token validity
 * @param {string} userId
 */
export async function testGoogleConnection(userId) {
  let auth;
  try {
    auth = await getAuthenticatedGoogleClient(userId);
  } catch (err) {
    return {
      connected: false,
      status: err.code || 'GOOGLE_NOT_CONNECTED',
      error: err.message,
      test: 'failed',
    };
  }

  try {
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const response = await oauth2.userinfo.get();

    return {
      connected: true,
      googleEmail: response.data.email,
      name: response.data.name,
      test: 'success',
      scopes: (await supabaseAdmin.from('google_connections').select('scopes').eq('user_id', userId).single()).data?.scopes || [],
    };
  } catch (apiErr) {
    console.warn(`[Google Test] API test failed for user ${userId}:`, apiErr.message);

    // If unauthorized or invalid_grant, mark reauthorization required
    if (apiErr.message?.includes('invalid_grant') || apiErr.code === 401 || apiErr.status === 401) {
      await markReauthorizationRequired(userId, apiErr.message);
      return {
        connected: false,
        status: 'reauthorization_required',
        error: 'Google credentials expired or were revoked. Please reconnect.',
        test: 'failed',
      };
    }

    return {
      connected: false,
      status: 'error',
      error: apiErr.message,
      test: 'failed',
    };
  }
}

export const getGoogleClient = getAuthenticatedGoogleClient;

export const googleClientFactory = {
  getAuthenticatedGoogleClient,
  getGoogleClient,
  testGoogleConnection,
  markReauthorizationRequired,
};
