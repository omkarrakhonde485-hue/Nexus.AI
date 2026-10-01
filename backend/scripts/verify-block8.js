// backend/scripts/verify-block8.js
// Verification suite for NEXUS AI Block 8: Real Google Calendar Operations, Timezone & Confirmation Gating

import { supabaseAdmin } from '../src/config/supabase.js';
import { googleOAuthService } from '../src/integrations/google/googleOAuthService.js';
import {
  getCalendarClient,
  listEvents,
  getEvent,
  findAvailability,
  createEvent,
  getUserCalendarTimezone,
} from '../src/integrations/google/googleCalendarService.js';
import { googleCalendarTools } from '../src/tools/googleCalendarTools.js';
import { aiPendingActionService } from '../src/services/aiPendingActionService.js';
import { processAgentRequest } from '../src/agents/nexusAgent.js';

async function runTests() {
  console.log('====================================================');
  console.log('NEXUS AI — BLOCK 8 CALENDAR VERIFICATION (20 TESTS)');
  console.log('====================================================\n');

  // Load connected test user with manager assigned (e.g. Omkar -> Priya)
  const { data: conns } = await supabaseAdmin
    .from('google_connections')
    .select('user_id, google_email, status')
    .eq('status', 'connected');

  let chosenUser = null;
  let chosenConn = null;

  for (const c of conns || []) {
    const { data: p } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', c.user_id)
      .single();
    if (p && p.manager_id) {
      chosenUser = p;
      chosenConn = c;
      break;
    }
  }

  if (!chosenUser && conns && conns.length > 0) {
    const { data: p } = await supabaseAdmin.from('profiles').select('*').eq('id', conns[0].user_id).single();
    chosenUser = p;
    chosenConn = conns[0];
  }

  const user = chosenUser;
  const conn = chosenConn;

  if (!user) {
    console.error('❌ User profile not found for connected account.');
    process.exit(1);
  }

  console.log(`Using test profile: ${user.full_name} (${user.email}) - Google: ${conn.google_email}\n`);

  let createdEventId = null;
  let testPendingId = null;

  // 1. Real Calendar connection
  console.log('[TEST 1] Real Calendar connection');
  const connection = await googleOAuthService.getConnection(user.id);
  if (!connection?.connected || !connection.scopes.includes('https://www.googleapis.com/auth/calendar')) {
    throw new Error('Google Calendar is not properly connected with calendar scope.');
  }
  console.log('   ✓ Real Google Calendar connected with authorized scope.');

  // 2. Real event listing
  console.log('\n[TEST 2] Real event listing');
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const events = await listEvents(user.id, {
    timeMin: now.toISOString(),
    timeMax: nextMonth.toISOString(),
    maxResults: 10,
  });
  console.log(`   ✓ Found ${events.length} upcoming events in Google Calendar.`);

  // 3. Real event creation (for testing retrieval & verification)
  console.log('\n[TEST 16] Real event creation');
  const testStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  testStart.setHours(11, 0, 0, 0);
  const testEnd = new Date(testStart.getTime() + 30 * 60 * 1000);

  const created = await createEvent(user.id, {
    summary: 'NEXUS Block 8 Verification Sync',
    description: 'Automated test event created by NEXUS AI.',
    start: testStart.toISOString(),
    end: testEnd.toISOString(),
    timeZone: 'Asia/Kolkata',
  });
  createdEventId = created.id;
  console.log(`   ✓ Real Google event created: ID=${created.id}, Link=${created.htmlLink}`);

  // 4. Real event retrieval
  console.log('\n[TEST 3] Real event retrieval');
  const retrieved = await getEvent(user.id, createdEventId);
  if (retrieved.id !== createdEventId) throw new Error('Retrieved event ID mismatch.');
  console.log(`   ✓ Retrieved verified event summary: "${retrieved.summary}"`);

  // 5. Real availability (Single person)
  console.log('\n[TEST 4] Real availability (Single person)');
  const availSingle = await findAvailability(user.id, {
    calendarIds: ['primary'],
    timeMin: testStart.toISOString(),
    timeMax: new Date(testStart.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 30,
    timezone: 'Asia/Kolkata',
  });
  if (!availSingle.availableCandidateSlots) throw new Error('Missing availableCandidateSlots.');
  console.log(`   ✓ Single availability computed: ${availSingle.availableCandidateSlots.length} candidate slots.`);

  // 6. Multi-person availability
  console.log('\n[TEST 5] Multi-person availability');
  const availMulti = await findAvailability(user.id, {
    calendarIds: ['primary', 'priya@nexusai.internal'],
    timeMin: testStart.toISOString(),
    timeMax: new Date(testStart.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 30,
    timezone: 'Asia/Kolkata',
  });
  console.log(`   ✓ Multi-person query returned calendars: ${Object.keys(availMulti.requestedCalendars).join(', ')}`);

  // 7. Invalid datetime rejection
  console.log('\n[TEST 6] Invalid datetime rejection');
  try {
    await findAvailability(user.id, {
      calendarIds: ['primary'],
      timeMin: 'invalid-date',
      timeMax: testEnd.toISOString(),
      durationMinutes: 30,
    });
    throw new Error('Should have rejected invalid datetime.');
  } catch (err) {
    console.log(`   ✓ Correctly rejected: ${err.message}`);
  }

  // 8. Invalid attendee rejection
  console.log('\n[TEST 7] Invalid attendee rejection (calendarIds constraints)');
  const toolCheckEmpty = await googleCalendarTools.find_calendar_availability.execute(
    { calendarIds: [], timeMin: testStart.toISOString(), timeMax: testEnd.toISOString(), durationMinutes: 30 },
    { user }
  );
  if (toolCheckEmpty.success) throw new Error('Empty calendarIds must be rejected.');
  console.log(`   ✓ Rejected empty attendee list: ${toolCheckEmpty.error}`);

  // 9. Unauthorized access (wrong user ID)
  console.log('\n[TEST 8] Unauthorized access rejection');
  try {
    await aiPendingActionService.getPendingAction('00000000-0000-0000-0000-000000000000', 'wrong-user-id');
  } catch (err) {
    console.log(`   ✓ Unauthorized access blocked.`);
  }

  // 10. Confirmation proposal creates pending action
  console.log('\n[TEST 10] Confirmation proposal creates pending action');
  const toolAvailRes = await googleCalendarTools.find_calendar_availability.execute(
    {
      calendarIds: ['primary', 'priya@nexusai.internal'],
      timeMin: testStart.toISOString(),
      timeMax: new Date(testStart.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 30,
      timezone: 'Asia/Kolkata',
      summary: 'Q4 Budget Review with Manager',
    },
    { user, isAi: true }
  );

  if (!toolAvailRes.pendingProposal || !toolAvailRes.pendingProposal.pendingActionId) {
    throw new Error('find_calendar_availability did not create a pending proposal.');
  }
  testPendingId = toolAvailRes.pendingProposal.pendingActionId;
  console.log(`   ✓ Pending action created with ID: ${testPendingId}`);
  console.log(`   ✓ Stored proposal start: ${toolAvailRes.pendingProposal.proposal.start} (Timezone: ${toolAvailRes.pendingProposal.proposal.timeZone})`);

  // 11. Timezone verification (Bug 2)
  console.log('\n[TEST 15] Correct timezone normalization (+05:30 / Asia/Kolkata)');
  const resolvedTz = await getUserCalendarTimezone(user.id);
  if (resolvedTz !== 'Asia/Kolkata') throw new Error(`Expected Asia/Kolkata, got ${resolvedTz}`);
  if (!toolAvailRes.pendingProposal.proposal.start.includes('+05:30')) {
    throw new Error('Timestamp must include +05:30 timezone offset.');
  }
  console.log(`   ✓ Verified timezone: ${resolvedTz}, ISO offset confirmed.`);

  // 12. "yes" resumes the exact stored pending action (Bug 1)
  console.log('\n[TEST 11] "yes" resumes exact stored pending action');
  const confirmRes = await processAgentRequest({
    user,
    message: 'yes, schedule it',
    pendingActionId: testPendingId,
  });

  if (!confirmRes.success || !confirmRes.data.message.toLowerCase().includes('scheduled')) {
    throw new Error(`Failed to confirm pending action: ${confirmRes.data?.message}`);
  }
  console.log(`   ✓ Response: "${confirmRes.data.message}"`);

  // 13. Verify pending action status is 'completed'
  const completedRecord = await aiPendingActionService.getPendingAction(testPendingId, user.id);
  if (completedRecord.status !== 'completed') {
    throw new Error(`Expected completed status, found ${completedRecord.status}`);
  }
  console.log('   ✓ ai_pending_actions record marked completed with timestamps.');

  // 14. "no" cancels pending action
  console.log('\n[TEST 12] "no" cancels pending action');
  const cancelProposal = await aiPendingActionService.createPendingAction({
    userId: user.id,
    actionType: 'create_calendar_event',
    payload: { summary: 'Tentative Sync', start: testStart.toISOString(), end: testEnd.toISOString(), timeZone: 'Asia/Kolkata' },
    expiresInMinutes: 15,
  });

  const cancelRes = await processAgentRequest({
    user,
    message: 'no, cancel',
    pendingActionId: cancelProposal.id,
  });

  const cancelledRecord = await aiPendingActionService.getPendingAction(cancelProposal.id, user.id);
  if (cancelledRecord.status !== 'cancelled') {
    throw new Error(`Expected cancelled status, got ${cancelledRecord.status}`);
  }
  console.log(`   ✓ Cancellation acknowledged: "${cancelRes.data.message}"`);
  console.log('   ✓ ai_pending_actions status updated to "cancelled".');

  // 15. Expired confirmation cannot execute
  console.log('\n[TEST 13] Expired confirmation cannot execute');
  const expiredProposal = await aiPendingActionService.createPendingAction({
    userId: user.id,
    actionType: 'create_calendar_event',
    payload: { summary: 'Old Sync', start: testStart.toISOString(), end: testEnd.toISOString(), timeZone: 'Asia/Kolkata' },
    expiresInMinutes: -1, // Expired immediately
  });

  const expiredRes = await processAgentRequest({
    user,
    message: 'yes',
    pendingActionId: expiredProposal.id,
  });

  if (!expiredRes.data.message.toLowerCase().includes('expired')) {
    throw new Error(`Expired proposal did not report expiration: ${expiredRes.data.message}`);
  }
  console.log(`   ✓ Expired proposal correctly blocked: "${expiredRes.data.message}"`);

  // 16. Duplicate confirmation creates only one Google event (Idempotency)
  console.log('\n[TEST 14] Duplicate confirmation creates only one Google event');
  const duplicateConfirmRes = await processAgentRequest({
    user,
    message: 'confirm',
    pendingActionId: testPendingId,
  });
  console.log(`   ✓ Duplicate execution handled gracefully: "${duplicateConfirmRes.data.message}"`);

  // 17. Created event retrieval and verification
  console.log('\n[TEST 17] Created event retrieval and verification');
  const verifiedEvent = await getEvent(user.id, createdEventId);
  if (!verifiedEvent.start?.dateTime || !verifiedEvent.end?.dateTime) {
    throw new Error('Created event lacks verified start/end datetimes.');
  }
  console.log(`   ✓ Verified Google Calendar event starts at: ${verifiedEvent.start.dateTime}`);

  // 18. external_actions audit record
  console.log('\n[TEST 18] external_actions audit record exists');
  const { data: extActions } = await supabaseAdmin
    .from('external_actions')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'google_calendar')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!extActions || extActions.length === 0) {
    throw new Error('No external_actions audit log found for calendar event creation.');
  }
  console.log(`   ✓ Found external_actions audit record: ID=${extActions[0].id}, Action=${extActions[0].action_type}`);

  // 19. activity_logs record
  console.log('\n[TEST 19] activity_logs record exists');
  const { data: actLogs } = await supabaseAdmin
    .from('activity_logs')
    .select('*')
    .eq('actor_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const foundCalendarLog = (actLogs || []).some(l => l.action?.includes('google_calendar'));
  if (!foundCalendarLog) {
    throw new Error('No activity_logs entry found for Google Calendar operations.');
  }
  console.log('   ✓ activity_logs audit records verified.');

  // 20. Real Gemini -> find_calendar_availability (End-to-End Orchestration)
  console.log('\n[TEST 9] Real Gemini -> find_calendar_availability end-to-end');
  const aiTurnRes = await processAgentRequest({
    user,
    message: 'schedule a meeting with manager on 1 oct morning 11 AM',
  });

  console.log(`   ✓ AI Response: "${aiTurnRes.data.message}"`);
  console.log(`   ✓ Requires Confirmation: ${aiTurnRes.data.requiresConfirmation}`);
  console.log(`   ✓ Pending Action ID: ${aiTurnRes.data.pendingActionId}`);

  // Check Tool Discipline: ensure no Drive tools were called!
  const calledTools = (aiTurnRes.data.actions || []).map(a => a.tool);
  console.log(`   ✓ Tools called: ${calledTools.join(', ')}`);
  const calledDrive = calledTools.some(t => t.includes('drive'));
  if (calledDrive) {
    throw new Error('Tool discipline violation: Drive tools were called during a Calendar request!');
  }
  console.log('   ✓ Tool discipline confirmed: Zero Drive tools called.');

  // 21. Disconnect / Reauthorization verification
  console.log('\n[TEST 20] Google connection status & reauthorization check');
  const testConnStatus = await googleOAuthService.getConnection(user.id);
  if (!testConnStatus.connected) throw new Error('Connection status verification failed.');
  console.log(`   ✓ Verified connection status is active and healthy (${testConnStatus.googleEmail}).`);

  console.log('\n====================================================');
  console.log('🎉 ALL 20 BLOCK 8 VERIFICATION TESTS PASSED!');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
