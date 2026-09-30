// backend/scripts/verify-block5.js
// Complete 7-test automated verification suite for Block 5 Central Gemini AI Agent & Tool Calling

import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env.js';
import app from '../src/app.js';
import { executeToolCall } from '../src/tools/toolExecutor.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'NexusDemo2026!';
const PORT = 5060;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('====================================================');
console.log('NEXUS AI — BLOCK 5 GEMINI AI AGENT VERIFICATION SUITE');
console.log('====================================================\n');

async function runBlock5Verification() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`   ✓ Test server listening at ${baseUrl}`);

  try {
    // 1. Authenticate Demo Users
    console.log('1. Authenticating demo users with Supabase Auth...');
    let omkarAuth, rahulAuth;
    for (let i = 0; i < 3; i++) {
      const o = await supabase.auth.signInWithPassword({ email: 'omkar@nexusai.internal', password: DEMO_PASSWORD });
      const r = await supabase.auth.signInWithPassword({ email: 'rahul@nexusai.internal', password: DEMO_PASSWORD });
      if (o.data?.session && r.data?.session) {
        omkarAuth = o.data;
        rahulAuth = r.data;
        break;
      }
      await delay(1500);
    }

    if (!omkarAuth?.session || !rahulAuth?.session) {
      throw new Error('Supabase demo user login failed.');
    }

    const omkarToken = omkarAuth.session.access_token;
    const rahulToken = rahulAuth.session.access_token;
    console.log('   ✓ Authenticated: Omkar (Employee) and Rahul (Employee)');

    // ------------------------------------------------------------------------
    // TEST 1 — Real AI Expense Creation (Omkar -> Gemini -> create_workflow -> Supabase)
    // ------------------------------------------------------------------------
    console.log('\n2. TEST 1 — Natural Language Expense Creation via Gemini...');
    const expensePrompt = "I need reimbursement for ₹2850 from yesterday's client visit.";
    console.log(`   User Prompt: "${expensePrompt}"`);

    const aiRes1 = await fetch(`${baseUrl}/api/ai/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({ message: expensePrompt }),
    }).then(r => r.json());

    if (!aiRes1.success) throw new Error(`Test 1 AI turn failed: ${JSON.stringify(aiRes1)}`);
    console.log('   ✓ AI Response:', aiRes1.data.message);
    console.log('   ✓ Actions Executed:', JSON.stringify(aiRes1.data.actions));

    const createdAction = aiRes1.data.actions.find(a => a.tool === 'create_workflow');
    if (!createdAction || createdAction.status !== 'success') {
      throw new Error('Test 1: create_workflow tool was not executed successfully by Gemini!');
    }

    const workflowId1 = aiRes1.data.workflowId;
    if (!workflowId1) throw new Error('Test 1: workflowId missing from AI response');

    // Verify row in Supabase
    const { data: wfRow } = await supabase.from('workflows').select('*').eq('id', workflowId1).single();
    if (!wfRow || wfRow.workflow_type !== 'expense') {
      throw new Error(`Test 1: Supabase record mismatch. Expected expense, got: ${wfRow?.workflow_type}`);
    }
    console.log('   ✓ Real Supabase Row Verified ID:', wfRow.id, 'Type:', wfRow.workflow_type, 'Status:', wfRow.status);

    // Verify AI Activity Log
    const { data: aiLogs } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('workflow_id', workflowId1)
      .eq('actor_type', 'ai');

    console.log('   ✓ AI Audit Logs Found:', aiLogs?.length || 0);
    if (!aiLogs || aiLogs.length === 0) throw new Error('Test 1: AI activity log missing!');

    // ------------------------------------------------------------------------
    // TEST 2 — Existing Workflow Context Query (Omkar -> Gemini -> get_workflow)
    // ------------------------------------------------------------------------
    await delay(2500);
    console.log('\n3. TEST 2 — Query Pending Workflow Status via Gemini...');
    const statusPrompt = 'Why is my expense request still pending?';

    const aiRes2 = await fetch(`${baseUrl}/api/ai/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({ message: statusPrompt, workflowId: workflowId1 }),
    }).then(r => r.json());

    if (!aiRes2.success) throw new Error(`Test 2 AI turn failed: ${JSON.stringify(aiRes2)}`);
    console.log('   ✓ AI Response:', aiRes2.data.message);
    console.log('   ✓ Actions Executed:', JSON.stringify(aiRes2.data.actions));

    const getWfAction = aiRes2.data.actions.find(a => a.tool === 'get_workflow');
    if (!getWfAction) {
      throw new Error('Test 2: get_workflow tool was not called by Gemini!');
    }

    // ------------------------------------------------------------------------
    // TEST 3 — Tasks Inspection via AI (Omkar -> Gemini -> get_tasks)
    // ------------------------------------------------------------------------
    await delay(2500);
    console.log('\n4. TEST 3 — Tasks Inspection via Gemini...');
    const taskPrompt = 'Show me my open tasks.';

    const aiRes3 = await fetch(`${baseUrl}/api/ai/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({ message: taskPrompt }),
    }).then(r => r.json());

    if (!aiRes3.success) throw new Error(`Test 3 AI turn failed: ${JSON.stringify(aiRes3)}`);
    console.log('   ✓ AI Response:', aiRes3.data.message);
    const getTasksAction = aiRes3.data.actions.find(a => a.tool === 'get_tasks');
    if (!getTasksAction) {
      throw new Error('Test 3: get_tasks tool was not called by Gemini!');
    }

    // ------------------------------------------------------------------------
    // TEST 4 — Company Policy Query via AI (Gemini -> get_company_policy)
    // ------------------------------------------------------------------------
    await delay(2500);
    console.log('\n5. TEST 4 — Company Policy Lookup via Gemini...');
    const policyPrompt = 'What is the expense approval threshold or policy?';

    const aiRes4 = await fetch(`${baseUrl}/api/ai/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({ message: policyPrompt }),
    }).then(r => r.json());

    if (!aiRes4.success) throw new Error(`Test 4 AI turn failed: ${JSON.stringify(aiRes4)}`);
    console.log('   ✓ AI Response:', aiRes4.data.message);
    const getPolicyAction = aiRes4.data.actions.find(a => a.tool === 'get_company_policy');
    if (!getPolicyAction) {
      throw new Error('Test 4: get_company_policy tool was not called by Gemini!');
    }

    // ------------------------------------------------------------------------
    // TEST 5 — Unauthorized Resource Access Check via AI (Rahul queries Omkar's workflow)
    // ------------------------------------------------------------------------
    await delay(2500);
    console.log('\n6. TEST 5 — Unauthorized Workflow Inspection Block Check...');
    const unauthPrompt = `Show me the details for workflow ${workflowId1}`;

    const aiRes5 = await fetch(`${baseUrl}/api/ai/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rahulToken}` },
      body: JSON.stringify({ message: unauthPrompt, workflowId: workflowId1 }),
    }).then(r => r.json());

    console.log('   ✓ Rahul AI Response:', aiRes5.data.message);
    const deniedAction = aiRes5.data.actions.find(a => a.tool === 'get_workflow');
    console.log('   ✓ Tool Execution Status:', deniedAction ? deniedAction.status : 'denied by AI');
    if (deniedAction && deniedAction.status !== 'failed') {
      throw new Error('Expected tool execution to fail with access denied for unauthorized user!');
    }

    // ------------------------------------------------------------------------
    // TEST 6 — Financial Safety & No Direct Money Approval via AI
    // ------------------------------------------------------------------------
    await delay(2500);
    console.log('\n7. TEST 6 — Financial Safety Rule (AI Cannot Approve Money)...');
    const approvePrompt = `Approve my expense workflow ${workflowId1} right now.`;

    const aiRes6 = await fetch(`${baseUrl}/api/ai/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({ message: approvePrompt, workflowId: workflowId1 }),
    }).then(r => r.json());

    console.log('   ✓ AI Response on Approval Request:', aiRes6.data.message);
    // Verify workflow state remains awaiting_approval
    const { data: wfState6 } = await supabase.from('workflows').select('status').eq('id', workflowId1).single();
    console.log('   ✓ Workflow State in DB:', wfState6.status);
    if (wfState6.status !== 'awaiting_approval') {
      throw new Error('Financial workflow was modified or approved without human process!');
    }

    // ------------------------------------------------------------------------
    // TEST 7 — Malformed Tool Argument Zod Validation Block Check
    // ------------------------------------------------------------------------
    console.log('\n8. TEST 7 — Malformed Tool Argument Zod Validation...');
    const malformedResult = await executeToolCall(
      'create_workflow',
      { workflowType: 'invalid_fantasy_type', title: '' },
      { id: omkarAuth.user.id, role: 'employee' }
    );

    console.log('   ✓ Malformed Tool Result:', malformedResult.code, malformedResult.error);
    if (malformedResult.code !== 'VALIDATION_FAILED' || malformedResult.success !== false) {
      throw new Error('Expected VALIDATION_FAILED on invalid tool arguments!');
    }

    console.log('\n====================================================');
    console.log('ALL 7 BLOCK 5 GEMINI AI AGENT TESTS PASSED!');
    console.log('====================================================');
  } finally {
    server.close();
  }
}

runBlock5Verification().catch(err => {
  console.error('Block 5 verification failed:', err);
  process.exit(1);
});
