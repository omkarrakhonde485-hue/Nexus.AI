import crypto from 'crypto';
import { google } from 'googleapis';
import { GOOGLE_OAUTH_CONFIG } from '../../config/google.js';
import { encryptionService } from '../../services/encryptionService.js';
import { supabaseAdmin } from '../../config/supabase.js';

export function createOAuth2Client() {
  if (!GOOGLE_OAUTH_CONFIG.clientId || !GOOGLE_OAUTH_CONFIG.clientSecret) {
    throw new Error('Google OAuth client credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are missing.');
  }

  return new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );
}

/**
 * Log Google integration activity
 */
async function logGoogleActivity(userId, actorType, action, description, metadata = {}) {
  try {
    await supabaseAdmin.from('activity_logs').insert({
      actor_type: actorType,
      actor_id: userId,
      action,
      description,
      metadata,
    });
  } catch (err) {
    console.warn(`[Google OAuth] Failed to log activity "${action}":`, err.message);
  }
}

/**
 * Generate Google OAuth authorization URL with CSRF state protection
 */
export async function createAuthorizationUrl(userId) {
  if (!userId) {
    throw new Error('User ID is required to initiate OAuth flow.');
  }

  // 1. Generate strong random state (32 bytes hex)
  const rawState = crypto.randomBytes(32).toString('hex');
  const stateHash = crypto.createHash('sha256').update(rawState).digest('hex');

  // 2. Set expiration (e.g. 10 minutes)
  const expiresAt = new Date(Date.now() + GOOGLE_OAUTH_CONFIG.stateTtlMinutes * 60 * 1000).toISOString();

  // 3. Store state_hash in oauth_states table
  const { error: insertError } = await supabaseAdmin.from('oauth_states').insert({
    user_id: userId,
    provider: 'google',
    state_hash: stateHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    throw new Error(`Failed to initialize OAuth state: ${insertError.message}`);
  }

  // 4. Create OAuth client and generate authorization URL
  const oauth2Client = createOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_OAUTH_CONFIG.scopes,
    state: rawState,
    include_granted_scopes: true,
  });

  return { authUrl, state: rawState };
}

/**
 * Handle Google OAuth callback: validate state, exchange code, encrypt refresh token, and persist connection
 */
export async function handleCallback(code, rawState) {
  if (!code || !rawState) {
    const error = new Error('Authorization code and state are required.');
    error.status = 400;
    error.code = 'OAUTH_MISSING_PARAMS';
    throw error;
  }

  // 1. Hash incoming state to match stored record
  const stateHash = crypto.createHash('sha256').update(rawState).digest('hex');

  // 2. Lookup state record
  const { data: stateRecord, error: stateError } = await supabaseAdmin
    .from('oauth_states')
    .select('*')
    .eq('provider', 'google')
    .eq('state_hash', stateHash)
    .single();

  if (stateError || !stateRecord) {
    const error = new Error('Invalid or non-existent OAuth state.');
    error.status = 400;
    error.code = 'OAUTH_STATE_INVALID';
    throw error;
  }

  // 3. Consume state immediately to enforce single-use
  await supabaseAdmin.from('oauth_states').delete().eq('id', stateRecord.id);

  // 4. Check expiration
  if (new Date(stateRecord.expires_at) < new Date()) {
    const error = new Error('OAuth state has expired.');
    error.status = 400;
    error.code = 'OAUTH_STATE_EXPIRED';
    throw error;
  }

  const userId = stateRecord.user_id;

  // 5. Exchange authorization code for tokens
  const oauth2Client = createOAuth2Client();
  let tokens;
  try {
    const tokenResponse = await oauth2Client.getToken(code);
    tokens = tokenResponse.tokens;
  } catch (err) {
    const error = new Error(`Failed to exchange authorization code with Google: ${err.message}`);
    error.status = 502;
    error.code = 'OAUTH_TOKEN_EXCHANGE_FAILED';
    throw error;
  }

  // 6. Check existing connection for user
  const { data: existingConnection } = await supabaseAdmin
    .from('google_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  let encryptedRefreshToken;
  if (tokens.refresh_token) {
    encryptedRefreshToken = encryptionService.encrypt(tokens.refresh_token);
  } else if (existingConnection?.refresh_token_encrypted) {
    // Preserve existing refresh token if Google didn't issue a new one
    encryptedRefreshToken = existingConnection.refresh_token_encrypted;
  } else {
    const error = new Error('Google did not return a refresh token. Reauthorization with consent is required.');
    error.status = 400;
    error.code = 'OAUTH_NO_REFRESH_TOKEN';
    throw error;
  }

  // 7. Get user's Google email
  oauth2Client.setCredentials(tokens);
  let googleEmail = 'unknown@google.com';
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    if (userInfo.data?.email) {
      googleEmail = userInfo.data.email;
    }
  } catch (err) {
    console.warn('[Google OAuth] Could not fetch user profile email:', err.message);
  }

  // 8. Persist to google_connections (UPSERT on user_id)
  const connectionPayload = {
    user_id: userId,
    google_email: googleEmail,
    refresh_token_encrypted: encryptedRefreshToken,
    scopes: GOOGLE_OAUTH_CONFIG.scopes,
    status: 'connected',
    expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabaseAdmin
    .from('google_connections')
    .upsert(connectionPayload, { onConflict: 'user_id' });

  if (upsertError) {
    throw new Error(`Failed to persist Google connection: ${upsertError.message}`);
  }

  // 9. Log activity
  await logGoogleActivity(
    userId,
    'google',
    'google_connected',
    `Connected Google account: ${googleEmail}`,
    { googleEmail, scopes: GOOGLE_OAUTH_CONFIG.scopes }
  );

  return {
    success: true,
    userId,
    googleEmail,
    status: 'connected',
  };
}

/**
 * Get safe connection metadata for a user (Never returns encrypted or decrypted tokens)
 */
export async function getConnection(userId) {
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from('google_connections')
    .select('id, user_id, google_email, scopes, status, expires_at, connected_at, updated_at')
    .eq('user_id', userId)
    .single();

  if (error || !data || data.status === 'disconnected') {
    return {
      connected: false,
      googleEmail: null,
      status: 'disconnected',
      scopes: [],
    };
  }

  return {
    connected: data.status === 'connected',
    googleEmail: data.google_email,
    status: data.status,
    scopes: data.scopes || [],
    connectedAt: data.connected_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Disconnect and revoke Google connection for a user
 */
export async function disconnect(userId) {
  if (!userId) {
    throw new Error('User ID is required to disconnect.');
  }

  const { data: connection } = await supabaseAdmin
    .from('google_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (connection && connection.refresh_token_encrypted) {
    try {
      const refreshToken = encryptionService.decrypt(connection.refresh_token_encrypted);
      const oauth2Client = createOAuth2Client();
      await oauth2Client.revokeToken(refreshToken);
    } catch (err) {
      console.warn('[Google OAuth] Token revocation failed (continuing disconnect):', err.message);
    }
  }

  // Delete connection row
  await supabaseAdmin.from('google_connections').delete().eq('user_id', userId);

  // Log activity
  await logGoogleActivity(
    userId,
    'user',
    'google_disconnected',
    'Disconnected Google Workspace integration'
  );

  return { success: true };
}

export const googleOAuthService = {
  createOAuth2Client,
  createAuthorizationUrl,
  handleCallback,
  getConnection,
  disconnect,
};
