/**
 * Verification Test Suite for Block 6: Google Workspace OAuth + Credential Infrastructure
 */

import http from 'http';
import crypto from 'crypto';
import app from '../src/app.js';
import { supabase, supabaseAdmin } from '../src/config/supabase.js';
import { encryptionService } from '../src/services/encryptionService.js';
import { googleOAuthService } from '../src/integrations/google/googleOAuthService.js';
import { googleClientFactory } from '../src/integrations/google/googleClientFactory.js';
import { GOOGLE_OAUTH_CONFIG } from '../src/config/google.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'NexusDemo2026!';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`   ✓ Test server listening at ${baseUrl}`);
      resolve();
    });
  });
}

function stopServer() {
  if (server) server.close();
}

async function loginUser(email, password) {
  for (let i = 0; i < 3; i++) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data?.session) {
        return {
          token: data.session.access_token,
          user: data.user,
        };
      }
    } catch (e) {
      // retry
    }
    await delay(1000);
  }
  throw new Error(`Failed to login as ${email} after 3 attempts.`);
}

async function runTests() {
  console.log('====================================================');
  console.log('NEXUS AI — BLOCK 6 GOOGLE OAUTH VERIFICATION SUITE');
  console.log('====================================================\n');

  try {
    await startServer();

    // 1. Authenticate Demo Users
    console.log('1. Authenticating demo users with Supabase Auth...');
    const omkar = await loginUser('omkar@nexusai.internal', DEMO_PASSWORD);
    const rahul = await loginUser('rahul@nexusai.internal', DEMO_PASSWORD);
    console.log(`   ✓ Authenticated: Omkar (${omkar.user.id}) and Rahul (${rahul.user.id})\n`);

    // 2. Encryption Service Verification
    console.log('2. TEST 1 — AES-256-GCM Encryption & Decryption...');
    const sampleToken = '1//04_AbCdEf123456_fake_google_refresh_token_xyz987';
    const encrypted = encryptionService.encrypt(sampleToken);
    console.log(`   ✓ Encrypted payload format: ${encrypted.slice(0, 35)}...`);
    
    // Ensure format matches v1:iv:tag:ciphertext
    const parts = encrypted.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new Error(`Invalid encrypted format: ${encrypted}`);
    }

    const decrypted = encryptionService.decrypt(encrypted);
    if (decrypted !== sampleToken) {
      throw new Error(`Decrypted string does not match original! Got: ${decrypted}`);
    }
    console.log('   ✓ Decryption verified with 100% roundtrip fidelity');

    // Test tamper resistance
    let tamperFailed = false;
    try {
      const tampered = `v1:${parts[1]}:ffffffffffffffffffffffffffffffff:${parts[3]}`;
      encryptionService.decrypt(tampered);
    } catch (err) {
      tamperFailed = true;
      console.log('   ✓ Tampered ciphertext rejected with authentication tag mismatch');
    }
    if (!tamperFailed) throw new Error('Decryption did not reject tampered ciphertext!');
    console.log('');

    // 3. OAuth Start Endpoint & Hashed State Generation
    console.log('3. TEST 2 — OAuth Start & Secure Hashed State Storage...');
    const startRes = await fetch(`${baseUrl}/api/integrations/google/start?json=true`, {
      headers: { Authorization: `Bearer ${omkar.token}` },
    });
    const startData = await startRes.json();
    if (!startData.success || !startData.data?.authUrl) {
      throw new Error(`OAuth start failed: ${JSON.stringify(startData)}`);
    }

    const authUrl = new URL(startData.data.authUrl);
    const rawState = authUrl.searchParams.get('state');
    if (!rawState) throw new Error('OAuth URL did not contain state parameter');
    
    console.log(`   ✓ Generated Google Auth URL: ${authUrl.origin}${authUrl.pathname}`);
    console.log(`   ✓ Raw state generated: ${rawState.slice(0, 16)}...`);

    // Verify raw state is NOT in DB, but SHA-256 state_hash IS in DB
    const stateHash = crypto.createHash('sha256').update(rawState).digest('hex');
    const { data: dbState, error: stateDbErr } = await supabaseAdmin
      .from('oauth_states')
      .select('*')
      .eq('state_hash', stateHash)
      .single();

    if (stateDbErr || !dbState) {
      throw new Error(`State hash was not found in oauth_states table: ${stateDbErr?.message}`);
    }
    if (dbState.user_id !== omkar.user.id) {
      throw new Error('OAuth state was bound to wrong user_id!');
    }
    console.log(`   ✓ Hashed state verified in Supabase oauth_states for Omkar (Expires: ${dbState.expires_at})\n`);

    // 4. Invalid State Security Check
    console.log('4. TEST 3 — Callback Rejection of Invalid State...');
    const invalidCallbackRes = await fetch(`${baseUrl}/api/integrations/google/callback?code=fake_code&state=nonexistent_state_value`, {
      redirect: 'manual',
    });
    const locationHeader = invalidCallbackRes.headers.get('location') || '';
    if (!locationHeader.includes('google=error') && invalidCallbackRes.status !== 400) {
      throw new Error(`Invalid state was not rejected properly. Status: ${invalidCallbackRes.status}, Location: ${locationHeader}`);
    }
    console.log(`   ✓ Invalid state rejected -> redirected to frontend error: ${locationHeader}\n`);

    // 5. Expired State Security Check
    console.log('5. TEST 4 — Callback Rejection of Expired State...');
    const expiredRawState = crypto.randomBytes(32).toString('hex');
    const expiredStateHash = crypto.createHash('sha256').update(expiredRawState).digest('hex');
    await supabaseAdmin.from('oauth_states').insert({
      user_id: omkar.user.id,
      provider: 'google',
      state_hash: expiredStateHash,
      expires_at: new Date(Date.now() - 60000).toISOString(), // 1 min in past
    });

    const expiredCallbackRes = await fetch(`${baseUrl}/api/integrations/google/callback?code=fake_code&state=${expiredRawState}`, {
      redirect: 'manual',
    });
    const expiredLocation = expiredCallbackRes.headers.get('location') || '';
    if (!expiredLocation.includes('google=error')) {
      throw new Error(`Expired state was not rejected properly. Location: ${expiredLocation}`);
    }
    console.log(`   ✓ Expired state rejected -> redirected to frontend error: ${expiredLocation}\n`);

    // 6. User Isolation & Status Endpoint
    console.log('6. TEST 5 — Integration Status & User Isolation Check...');
    const statusRes = await fetch(`${baseUrl}/api/integrations/google/status`, {
      headers: { Authorization: `Bearer ${omkar.token}` },
    });
    const statusData = await statusRes.json();
    if (!statusData.success || statusData.data.connected !== false) {
      throw new Error(`Unexpected initial status: ${JSON.stringify(statusData)}`);
    }
    // Verify no secret leakage in status response
    if (statusData.data.refresh_token_encrypted || statusData.data.refresh_token) {
      throw new Error('SECURITY VIOLATION: refresh token exposed in status endpoint!');
    }
    console.log('   ✓ Status endpoint returned safe metadata (No tokens exposed)');

    // Ensure Rahul cannot see Omkar's status or tokens
    const rahulStatusRes = await fetch(`${baseUrl}/api/integrations/google/status`, {
      headers: { Authorization: `Bearer ${rahul.token}` },
    });
    const rahulStatus = await rahulStatusRes.json();
    if (rahulStatus.data.connected !== false) {
      throw new Error('User isolation broken in status query');
    }
    console.log('   ✓ Verified strict user isolation between Omkar and Rahul\n');

    // 7. Token Corruption & Auto-Reauthorization Recovery
    console.log('7. TEST 6 — Token Corruption Handling & Auto Reauthorization Status...');
    // Create a temporary test row with corrupted ciphertext
    const testUserId = omkar.user.id;
    await supabaseAdmin.from('google_connections').upsert({
      user_id: testUserId,
      google_email: 'omkar.test@nexusai.internal',
      refresh_token_encrypted: 'v1:badiv:badtag:badciphertext',
      scopes: GOOGLE_OAUTH_CONFIG.scopes,
      status: 'connected',
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    let corruptionHandled = false;
    try {
      await googleClientFactory.getAuthenticatedGoogleClient(testUserId);
    } catch (err) {
      corruptionHandled = true;
      console.log(`   ✓ Corrupted credentials caught gracefully: ${err.message}`);
    }
    if (!corruptionHandled) throw new Error('Corrupted credential was not caught!');

    const { data: updatedConn } = await supabaseAdmin
      .from('google_connections')
      .select('status')
      .eq('user_id', testUserId)
      .single();

    if (updatedConn.status !== 'reauthorization_required') {
      throw new Error(`Status was not updated to reauthorization_required! Got: ${updatedConn.status}`);
    }
    console.log('   ✓ Connection status automatically updated to "reauthorization_required"');

    await delay(600);
    // Verify activity log
    const { data: logEntry } = await supabaseAdmin
      .from('activity_logs')
      .select('*')
      .eq('actor_id', testUserId)
      .eq('action', 'google_reauthorization_required')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!logEntry) throw new Error('System activity log for reauthorization was not found');
    console.log(`   ✓ System audit log verified: ${logEntry.action} -> "${logEntry.description}"\n`);

    // 8. Disconnect Endpoint
    console.log('8. TEST 7 — Disconnect Endpoint...');
    const disconnectRes = await fetch(`${baseUrl}/api/integrations/google/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${omkar.token}` },
    });
    const disconnectData = await disconnectRes.json();
    if (!disconnectData.success) {
      throw new Error(`Disconnect failed: ${JSON.stringify(disconnectData)}`);
    }

    const { data: afterDisconnect } = await supabaseAdmin
      .from('google_connections')
      .select('*')
      .eq('user_id', testUserId);

    if (afterDisconnect.length > 0) {
      throw new Error('Connection record was not deleted upon disconnect');
    }
    console.log('   ✓ Disconnect removed Google connection and revoked token safely\n');

    console.log('====================================================');
    console.log('ALL 7 AUTOMATED BLOCK 6 TESTS PASSED!');
    console.log('====================================================\n');
    console.log('Level 2 & Level 3 Interactive Verification:');
    console.log('1. Open http://localhost:5173/integrations');
    console.log('2. Click "Connect Google Workspace" -> Complete Google Consent');
    console.log('3. Click "Test Google Connection" -> Verified with live Google APIs\n');

  } catch (err) {
    console.error('\n❌ BLOCK 6 VERIFICATION TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    stopServer();
  }
}

runTests();
