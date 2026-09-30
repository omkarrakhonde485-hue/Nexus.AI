// backend/scripts/verify-block3.js
// Automated verification suite for Block 3 Auth & RBAC

import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env.js';
import app from '../src/app.js';
import { canApproveWorkflow } from '../src/services/permissionService.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'NexusDemo2026!';
const PORT = 5020;

console.log('====================================================');
console.log('NEXUS AI — BLOCK 3 AUTH & RBAC VERIFICATION SUITE');
console.log('====================================================\n');

async function runBlock3Verification() {
  const server = app.listen(PORT, '0.0.0.0');

  try {
    // 1. Authenticate Demo Users via Supabase Auth
    console.log('1. Authenticating demo accounts via Supabase Auth...');

    const { data: omkarAuth, error: omkarErr } = await supabase.auth.signInWithPassword({
      email: 'omkar@nexusai.internal',
      password: DEMO_PASSWORD,
    });
    if (omkarErr) throw omkarErr;
    console.log('   ✓ Logged in as Omkar (Employee)');

    const { data: priyaAuth, error: priyaErr } = await supabase.auth.signInWithPassword({
      email: 'priya@nexusai.internal',
      password: DEMO_PASSWORD,
    });
    if (priyaErr) throw priyaErr;
    console.log('   ✓ Logged in as Priya (Manager)');

    const { data: aaravAuth, error: aaravErr } = await supabase.auth.signInWithPassword({
      email: 'aarav@nexusai.internal',
      password: DEMO_PASSWORD,
    });
    if (aaravErr) throw aaravErr;
    console.log('   ✓ Logged in as Aarav (Admin)');

    const omkarToken = omkarAuth.session.access_token;
    const priyaToken = priyaAuth.session.access_token;
    const aaravToken = aaravAuth.session.access_token;

    // 2. Test GET /api/auth/me for Omkar
    console.log('\n2. Testing GET /api/auth/me for Omkar...');
    const omkarMe = await fetch(`http://localhost:${PORT}/api/auth/me`, {
      headers: { Authorization: `Bearer ${omkarToken}` },
    }).then(r => r.json());

    console.log('   ✓ Response:', JSON.stringify(omkarMe));
    if (omkarMe.data?.profile?.role !== 'employee') {
      throw new Error('Expected Omkar role to be employee');
    }
    if (!omkarMe.data?.profile?.managerId) {
      throw new Error('Expected Omkar to have managerId pointing to Priya');
    }
    console.log('   ✓ Verified Omkar profile, role (employee), and manager linkage (Priya)!');

    // 3. Test GET /api/auth/me for Priya
    console.log('\n3. Testing GET /api/auth/me for Priya...');
    const priyaMe = await fetch(`http://localhost:${PORT}/api/auth/me`, {
      headers: { Authorization: `Bearer ${priyaToken}` },
    }).then(r => r.json());
    console.log('   ✓ Priya Role:', priyaMe.data?.profile?.role);
    if (priyaMe.data?.profile?.role !== 'manager') {
      throw new Error('Expected Priya role to be manager');
    }

    // 4. Test GET /api/auth/me for Aarav
    console.log('\n4. Testing GET /api/auth/me for Aarav...');
    const aaravMe = await fetch(`http://localhost:${PORT}/api/auth/me`, {
      headers: { Authorization: `Bearer ${aaravToken}` },
    }).then(r => r.json());
    console.log('   ✓ Aarav Role:', aaravMe.data?.profile?.role);
    if (aaravMe.data?.profile?.role !== 'admin') {
      throw new Error('Expected Aarav role to be admin');
    }

    // 5. MOST IMPORTANT AUTHORIZATION PROOF: Employee attempts Admin operation -> 403 FORBIDDEN
    console.log('\n5. Executing Most Important Test: Employee Omkar calls Admin endpoint...');
    const forbiddenRes = await fetch(`http://localhost:${PORT}/api/auth/admin-only-test`, {
      headers: { Authorization: `Bearer ${omkarToken}` },
    });
    const forbiddenBody = await forbiddenRes.json();
    console.log(`   ✓ HTTP Status: ${forbiddenRes.status}`);
    console.log(`   ✓ Body:`, JSON.stringify(forbiddenBody));

    if (forbiddenRes.status !== 403 || forbiddenBody.error?.code !== 'FORBIDDEN') {
      throw new Error('Expected 403 FORBIDDEN when employee calls admin route!');
    }
    console.log('   ✓ PROOF PASSED: Backend strictly enforced 403 FORBIDDEN for unauthorized role!');

    // 6. Admin calls Admin endpoint -> 200 SUCCESS
    console.log('\n6. Admin Aarav calls Admin endpoint...');
    const adminRes = await fetch(`http://localhost:${PORT}/api/auth/admin-only-test`, {
      headers: { Authorization: `Bearer ${aaravToken}` },
    });
    const adminBody = await adminRes.json();
    console.log(`   ✓ HTTP Status: ${adminRes.status}`);
    console.log(`   ✓ Body:`, JSON.stringify(adminBody));
    if (adminRes.status !== 200 || !adminBody.success) {
      throw new Error('Expected 200 SUCCESS when admin calls admin route!');
    }

    // 7. Authentication Failure Tests
    console.log('\n7. Testing Authentication Failures...');
    const noTokenRes = await fetch(`http://localhost:${PORT}/api/auth/me`);
    const noTokenBody = await noTokenRes.json();
    console.log('   ✓ No Token Status:', noTokenRes.status, noTokenBody.error?.code);
    if (noTokenRes.status !== 401 || noTokenBody.error?.code !== 'AUTHENTICATION_REQUIRED') {
      throw new Error('Expected 401 AUTHENTICATION_REQUIRED');
    }

    const invalidTokenRes = await fetch(`http://localhost:${PORT}/api/auth/me`, {
      headers: { Authorization: 'Bearer INVALID_TOKEN_12345' },
    });
    const invalidTokenBody = await invalidTokenRes.json();
    console.log('   ✓ Invalid Token Status:', invalidTokenRes.status, invalidTokenBody.error?.code);
    if (invalidTokenRes.status !== 401 || invalidTokenBody.error?.code !== 'INVALID_AUTHENTICATION') {
      throw new Error('Expected 401 INVALID_AUTHENTICATION');
    }

    // 8. Profile Privilege Escalation Prevention Test
    console.log('\n8. Testing Profile Privilege Escalation Prevention...');
    const hackAttemptRes = await fetch(`http://localhost:${PORT}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${omkarToken}`,
      },
      body: JSON.stringify({ role: 'admin', fullName: 'Omkar Updated' }),
    }).then(r => r.json());

    console.log('   ✓ Update Response Role:', hackAttemptRes.data?.profile?.role);
    if (hackAttemptRes.data?.profile?.role !== 'employee') {
      throw new Error('Security flaw: User was able to escalate role to admin!');
    }
    console.log('   ✓ Privilege escalation blocked! Role remains employee.');

    // 9. Manager Approval Authorization Rule Test
    console.log('\n9. Testing Approval Authorization Rule logic...');
    const mockWorkflow = { created_by: omkarMe.data.user.id };
    const omkarProfile = { ...omkarMe.data.profile, id: omkarMe.data.user.id };
    const priyaProfile = { ...priyaMe.data.profile, id: priyaMe.data.user.id };

    const omkarCanApproveSelf = canApproveWorkflow(omkarProfile, mockWorkflow, omkarProfile);
    const priyaCanApproveOmkar = canApproveWorkflow(priyaProfile, mockWorkflow, omkarProfile);

    console.log(`   ✓ Can Omkar approve his own request? ${omkarCanApproveSelf} (Expected: false)`);
    console.log(`   ✓ Can Priya (Manager) approve Omkar's request? ${priyaCanApproveOmkar} (Expected: true)`);

    if (omkarCanApproveSelf !== false || priyaCanApproveOmkar !== true) {
      throw new Error('Approval logic failed manager/self authorization check!');
    }

    console.log('\n====================================================');
    console.log('ALL BLOCK 3 ACCEPTANCE TESTS PASSED SUCCESSFULLY');
    console.log('====================================================');
  } finally {
    server.close();
  }
}

runBlock3Verification().catch(err => {
  console.error('Block 3 verification failed:', err);
  process.exit(1);
});
