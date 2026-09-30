// backend/scripts/verify-block4.js
// Complete 10-test automated verification suite for Block 4 Core Workflow Engine

import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env.js';
import app from '../src/app.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'NexusDemo2026!';
const PORT = 5030;

console.log('====================================================');
console.log('NEXUS AI — BLOCK 4 WORKFLOW ENGINE VERIFICATION SUITE');
console.log('====================================================\n');

async function runBlock4Verification() {
  const server = app.listen(PORT, '0.0.0.0');

  try {
    // 1. Authenticate Demo Users
    console.log('1. Authenticating demo users...');
    const { data: omkarAuth } = await supabase.auth.signInWithPassword({ email: 'omkar@nexusai.internal', password: DEMO_PASSWORD });
    const { data: priyaAuth } = await supabase.auth.signInWithPassword({ email: 'priya@nexusai.internal', password: DEMO_PASSWORD });
    const { data: nehaAuth } = await supabase.auth.signInWithPassword({ email: 'neha@nexusai.internal', password: DEMO_PASSWORD });
    const { data: ananyaAuth } = await supabase.auth.signInWithPassword({ email: 'ananya@nexusai.internal', password: DEMO_PASSWORD });
    const { data: vikramAuth } = await supabase.auth.signInWithPassword({ email: 'vikram@nexusai.internal', password: DEMO_PASSWORD });
    const { data: rahulAuth } = await supabase.auth.signInWithPassword({ email: 'rahul@nexusai.internal', password: DEMO_PASSWORD });

    const omkarToken = omkarAuth.session.access_token;
    const priyaToken = priyaAuth.session.access_token;
    const nehaToken = nehaAuth.session.access_token;
    const ananyaToken = ananyaAuth.session.access_token;
    const vikramToken = vikramAuth.session.access_token;
    const rahulToken = rahulAuth.session.access_token;

    console.log('   ✓ Authenticated: Omkar, Priya, Neha, Ananya, Vikram, Rahul');

    // ------------------------------------------------------------------------
    // TEST 1 — Approval Chain (Omkar creates -> Priya approves -> advances)
    // ------------------------------------------------------------------------
    console.log('\n2. TEST 1 — Approval Chain Execution...');
    const wf1 = await fetch(`http://localhost:${PORT}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({ workflowType: 'approval', title: 'Project Alpha Budget Approval', priority: 'normal' }),
    }).then(r => r.json());

    if (!wf1.success) throw new Error(`Test 1 workflow creation failed: ${JSON.stringify(wf1)}`);
    console.log('   ✓ Approval Workflow Created ID:', wf1.data.workflow.id, 'Status:', wf1.data.workflow.status);

    // Fetch approval created for Priya
    const appList1 = await fetch(`http://localhost:${PORT}/api/approvals`, {
      headers: { Authorization: `Bearer ${priyaToken}` },
    }).then(r => r.json());

    const approval1 = appList1.data.approvals.find(a => a.workflow_id === wf1.data.workflow.id);
    if (!approval1) throw new Error('Test 1: Approval for Priya not found!');
    console.log('   ✓ Approval generated ID:', approval1.id, 'for Approver ID:', approval1.approver_id);

    // Priya approves
    const approveRes1 = await fetch(`http://localhost:${PORT}/api/approvals/${approval1.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${priyaToken}` },
      body: JSON.stringify({ comments: 'Approved by Manager Priya' }),
    }).then(r => r.json());

    if (!approveRes1.success) throw new Error(`Test 1 approval failed: ${JSON.stringify(approveRes1)}`);
    console.log('   ✓ Manager Priya approved! Status:', approveRes1.data.approval.status);

    // ------------------------------------------------------------------------
    // TEST 2 — Self-Approval Prevention (Omkar attempts to approve own request)
    // ------------------------------------------------------------------------
    console.log('\n3. TEST 2 — Self-Approval Prevention Check...');
    const wf2 = await fetch(`http://localhost:${PORT}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({ workflowType: 'approval', title: 'Omkar Self Approval Test' }),
    }).then(r => r.json());

    const appList2 = await fetch(`http://localhost:${PORT}/api/approvals`, {
      headers: { Authorization: `Bearer ${priyaToken}` },
    }).then(r => r.json());
    const approval2 = appList2.data.approvals.find(a => a.workflow_id === wf2.data.workflow.id);

    const selfApproveRes = await fetch(`http://localhost:${PORT}/api/approvals/${approval2.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
    });
    const selfApproveBody = await selfApproveRes.json();
    console.log('   ✓ Self-Approval HTTP Status:', selfApproveRes.status, selfApproveBody.error?.code);
    if (selfApproveRes.status !== 403) throw new Error('Expected 403 FORBIDDEN when user attempts self-approval!');

    // ------------------------------------------------------------------------
    // TEST 3 — Wrong Manager Approval Check (Neha attempts to approve Omkar)
    // ------------------------------------------------------------------------
    console.log('\n4. TEST 3 — Wrong Manager Approval Block Check...');
    const wrongMgrRes = await fetch(`http://localhost:${PORT}/api/approvals/${approval2.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nehaToken}` },
    });
    const wrongMgrBody = await wrongMgrRes.json();
    console.log('   ✓ Wrong Manager HTTP Status:', wrongMgrRes.status, wrongMgrBody.error?.code);
    if (wrongMgrRes.status !== 403) throw new Error('Expected 403 FORBIDDEN when wrong manager attempts approval!');

    // ------------------------------------------------------------------------
    // TEST 4 — Expense Workflow (Omkar creates -> Priya approves -> Finance Task)
    // ------------------------------------------------------------------------
    console.log('\n5. TEST 4 — Expense Flow (Manager Approval -> Finance Task)...');
    const wf4 = await fetch(`http://localhost:${PORT}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({
        workflowType: 'expense',
        title: 'Mumbai Client Visit Expense',
        aiData: { amount: 2850, category: 'business_travel' },
      }),
    }).then(r => r.json());

    const appList4 = await fetch(`http://localhost:${PORT}/api/approvals`, {
      headers: { Authorization: `Bearer ${priyaToken}` },
    }).then(r => r.json());
    const approval4 = appList4.data.approvals.find(a => a.workflow_id === wf4.data.workflow.id);

    // Priya approves expense
    await fetch(`http://localhost:${PORT}/api/approvals/${approval4.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${priyaToken}` },
    });

    // Check Finance Task created for Neha
    const taskList4 = await fetch(`http://localhost:${PORT}/api/tasks`, {
      headers: { Authorization: `Bearer ${nehaToken}` },
    }).then(r => r.json());

    const financeTask = taskList4.data.tasks.find(t => t.workflow_id === wf4.data.workflow.id);
    if (!financeTask) throw new Error('Test 4: Finance processing task not created after approval!');
    console.log('   ✓ Expense Approved! Finance Task Created:', financeTask.title, 'Assignee Role:', financeTask.assignee_role);

    // ------------------------------------------------------------------------
    // TEST 5 — Onboarding Parallel Tasks
    // ------------------------------------------------------------------------
    console.log('\n6. TEST 5 — Employee Onboarding Parallel Tasks...');
    const wf5 = await fetch(`http://localhost:${PORT}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ananyaToken}` },
      body: JSON.stringify({ workflowType: 'onboarding', title: 'Onboarding New Engineer' }),
    }).then(r => r.json());

    const steps5 = await fetch(`http://localhost:${PORT}/api/workflows/${wf5.data.workflow.id}/steps`, {
      headers: { Authorization: `Bearer ${ananyaToken}` },
    }).then(r => r.json());

    console.log('   ✓ Parallel Onboarding Steps Created:', steps5.data.steps.length);
    if (steps5.data.steps.length < 3) throw new Error('Expected at least 3 onboarding steps!');

    // ------------------------------------------------------------------------
    // TEST 6 — Helpdesk Ticket & SLA Status
    // ------------------------------------------------------------------------
    console.log('\n7. TEST 6 — Helpdesk IT Ticket & SLA Status...');
    const wf6 = await fetch(`http://localhost:${PORT}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({ workflowType: 'helpdesk', title: 'Wi-Fi Connection Issue', priority: 'critical' }),
    }).then(r => r.json());

    const getWf6 = await fetch(`http://localhost:${PORT}/api/workflows/${wf6.data.workflow.id}`, {
      headers: { Authorization: `Bearer ${omkarToken}` },
    }).then(r => r.json());

    console.log('   ✓ Critical Helpdesk Created. SLA Due:', getWf6.data.workflow.sla_due_at, 'Status:', getWf6.data.slaStatus);
    if (!getWf6.data.slaStatus) throw new Error('SLA status calculation missing!');

    // ------------------------------------------------------------------------
    // TEST 7 — Rejection Flow
    // ------------------------------------------------------------------------
    console.log('\n8. TEST 7 — Approval Rejection Execution...');
    const wf7 = await fetch(`http://localhost:${PORT}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({ workflowType: 'approval', title: 'Laptop Upgrade Request' }),
    }).then(r => r.json());

    const appList7 = await fetch(`http://localhost:${PORT}/api/approvals`, {
      headers: { Authorization: `Bearer ${priyaToken}` },
    }).then(r => r.json());
    const approval7 = appList7.data.approvals.find(a => a.workflow_id === wf7.data.workflow.id);

    const rejectRes = await fetch(`http://localhost:${PORT}/api/approvals/${approval7.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${priyaToken}` },
      body: JSON.stringify({ comments: 'Outside current equipment budget.' }),
    }).then(r => r.json());

    console.log('   ✓ Approval Rejected! Status:', rejectRes.data.approval.status);
    const getWf7 = await fetch(`http://localhost:${PORT}/api/workflows/${wf7.data.workflow.id}`, {
      headers: { Authorization: `Bearer ${omkarToken}` },
    }).then(r => r.json());
    console.log('   ✓ Workflow State After Rejection:', getWf7.data.workflow.status);
    if (getWf7.data.workflow.status !== 'rejected') throw new Error('Expected workflow status to be rejected');

    // ------------------------------------------------------------------------
    // TEST 8 — Workflow Cancellation
    // ------------------------------------------------------------------------
    console.log('\n9. TEST 8 — Workflow Cancellation...');
    const wf8 = await fetch(`http://localhost:${PORT}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({ workflowType: 'helpdesk', title: 'Draft Support Ticket' }),
    }).then(r => r.json());

    const cancelRes = await fetch(`http://localhost:${PORT}/api/workflows/${wf8.data.workflow.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
      body: JSON.stringify({ reason: 'Meeting postponed' }),
    }).then(r => r.json());

    console.log('   ✓ Workflow Cancelled Status:', cancelRes.data.workflow.status);
    if (cancelRes.data.workflow.status !== 'cancelled') throw new Error('Expected workflow status to be cancelled');

    // ------------------------------------------------------------------------
    // TEST 9 — Invalid State Transition Blocked
    // ------------------------------------------------------------------------
    console.log('\n10. TEST 9 — Invalid State Transition Check...');
    const invalidTransRes = await fetch(`http://localhost:${PORT}/api/workflows/${wf8.data.workflow.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${omkarToken}` },
    });
    console.log('   ✓ Re-cancelling cancelled workflow status:', invalidTransRes.status);
    if (invalidTransRes.status !== 400) throw new Error('Expected 400 when transitioning terminal workflow!');

    // ------------------------------------------------------------------------
    // TEST 10 — Authorization Check (Rahul attempts to read Omkar workflow)
    // ------------------------------------------------------------------------
    console.log('\n11. TEST 10 — Unauthorized Resource Access Block Check...');
    const unauthReadRes = await fetch(`http://localhost:${PORT}/api/workflows/${wf1.data.workflow.id}`, {
      headers: { Authorization: `Bearer ${rahulToken}` },
    });
    console.log('   ✓ Rahul accessing Omkar workflow status:', unauthReadRes.status);
    if (unauthReadRes.status !== 403) throw new Error('Expected 403 FORBIDDEN when user accesses unauthorized workflow!');

    console.log('\n====================================================');
    console.log('ALL 10 BLOCK 4 WORKFLOW ENGINE TESTS PASSED!');
    console.log('====================================================');
  } finally {
    server.close();
  }
}

runBlock4Verification().catch(err => {
  console.error('Block 4 verification failed:', err);
  process.exit(1);
});
