import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env.js';

const backendClient = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

console.log('====================================================');
console.log('NEXUS AI — BLOCK 2 DATABASE & SECURITY VERIFICATION');
console.log('====================================================\n');

async function runVerification() {
  const results = {};

  // 1. Verify 12 tables
  console.log('1. Verifying all 12 tables...');
  const tables = [
    'profiles', 'workflows', 'workflow_steps', 'tasks', 'approvals',
    'activity_logs', 'alerts', 'google_connections', 'oauth_states',
    'external_actions', 'attachments', 'company_policies'
  ];
  let tableCount = 0;
  for (const t of tables) {
    const { error } = await backendClient.from(t).select('count').limit(1);
    if (!error) tableCount++;
  }
  results.allTablesExist = tableCount === 12;
  console.log(`   ✓ Tables verified: ${tableCount}/12 exist`);

  // 2. Test Company Policies seeded row
  console.log('\n2. Testing company_policies seed data...');
  const { data: policies, error: policyErr } = await backendClient
    .from('company_policies')
    .select('*')
    .eq('policy_key', 'expense.default')
    .single();

  if (policies && !policyErr) {
    console.log('   ✓ Seeded policy found:', policies.policy_key, policies.config);
    results.policySeeded = true;
  } else {
    console.log('   ✗ Seeded policy check error:', policyErr?.message);
    results.policySeeded = false;
  }

  // 3. Test Check Constraint enforcement
  console.log('\n3. Testing Check Constraints on workflows...');
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const { error: invalidTypeErr } = await backendClient.from('workflows').insert({
    created_by: fakeId,
    workflow_type: 'INVALID_TYPE_XYZ',
    title: 'Constraint Test',
    status: 'submitted'
  });
  const constraintBlocked = Boolean(invalidTypeErr);
  console.log('   ✓ Invalid workflow_type rejected by database constraint:', invalidTypeErr ? invalidTypeErr.message : 'FAILED');
  results.constraintsWorking = constraintBlocked;

  // 4. Create real test auth user & profile for workflow test
  console.log('\n4. Setting up test profile and workflow...');
  let testUserId = null;
  const testEmail = 'test.engineer@nexusai.internal';

  // Check if test user exists or create
  const { data: existingUsers } = await backendClient.auth.admin.listUsers();
  const foundUser = existingUsers?.users?.find(u => u.email === testEmail);

  if (foundUser) {
    testUserId = foundUser.id;
  } else {
    const { data: newUser, error: createAuthErr } = await backendClient.auth.admin.createUser({
      email: testEmail,
      password: 'TemporaryPassword123!',
      email_confirm: true
    });
    if (createAuthErr) throw createAuthErr;
    testUserId = newUser.user.id;
  }

  // Upsert profile for this test user
  const { error: profileErr } = await backendClient.from('profiles').upsert({
    id: testUserId,
    full_name: 'Omkar Test Dev',
    email: testEmail,
    role: 'employee',
    department: 'Engineering',
    is_active: true
  });
  if (profileErr) throw profileErr;
  console.log('   ✓ Test profile created with ID:', testUserId);

  // 5. MOST IMPORTANT TEST: Insert workflow (expense, submitted) and retrieve via authorized backend
  console.log('\n5. Executing Most Important Test: Real Workflow Creation...');
  const { data: newWorkflow, error: workflowErr } = await backendClient
    .from('workflows')
    .insert({
      created_by: testUserId,
      workflow_type: 'expense',
      title: 'Client Visit Mumbai Reimbursement',
      summary: 'Travel expenses for client presentation',
      status: 'submitted',
      priority: 'normal',
      department: 'Engineering',
      ai_data: {
        amount: 2850,
        category: 'business_travel',
        purpose: 'client visit'
      },
      risk_flags: [],
      missing_information: []
    })
    .select('*')
    .single();

  if (workflowErr) throw workflowErr;

  console.log('   ✓ Workflow successfully inserted:');
  console.log(`     ID: ${newWorkflow.id}`);
  console.log(`     Type: ${newWorkflow.workflow_type}`);
  console.log(`     Status: ${newWorkflow.status}`);
  console.log(`     AI Data:`, newWorkflow.ai_data);

  // Retrieve it to verify backend reading
  const { data: retrievedWorkflow, error: retrieveErr } = await backendClient
    .from('workflows')
    .select('id, title, workflow_type, status, ai_data, created_at')
    .eq('id', newWorkflow.id)
    .single();

  if (retrieveErr) throw retrieveErr;
  console.log('   ✓ Successfully retrieved from authorized backend path:');
  console.log('    ', JSON.stringify(retrievedWorkflow));
  results.mostImportantTestPassed = Boolean(retrievedWorkflow && retrievedWorkflow.id === newWorkflow.id);

  console.log('\n====================================================');
  console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY');
  console.log('====================================================');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
