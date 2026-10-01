// backend/src/tools/googleCalendarTools.js
// Tools for Google Calendar reading, availability calculations, pending action creation, and event scheduling

import { listEvents, getEvent, findAvailability, createEvent } from '../integrations/google/googleCalendarService.js';
import { supabaseAdmin } from '../config/supabase.js';
import { TOOL_RISK_LEVELS } from './toolConstants.js';
import { aiPendingActionService } from '../services/aiPendingActionService.js';

// Helper to log to activity_logs
async function logCalendarAction(userId, actorType, action, tool, externalId, status, metadata = {}) {
  try {
    const { error } = await supabaseAdmin.from('activity_logs').insert({
      actor_id: userId,
      actor_type: actorType || 'ai',
      action: action,
      description: `Google Calendar: ${action} via ${tool}`,
      metadata: { tool, external_id: externalId, status, ...metadata }
    });
    if (error) {
      console.error('Failed to log calendar action to activity_logs:', error.message);
    }
  } catch (err) {
    console.error('Failed to log calendar action:', err.message);
  }
}

// Helper to record external action
async function recordExternalAction({ userId, actionType, idempotencyKey, externalId, status, requestMetadata }) {
  try {
    const validStatus = status === 'success' ? 'completed' : status;
    const { error } = await supabaseAdmin.from('external_actions').insert({
      user_id: userId,
      provider: 'google_calendar',
      action_type: actionType,
      idempotency_key: idempotencyKey,
      external_id: externalId,
      status: validStatus,
      request_metadata: requestMetadata || {}
    });
    if (error && error.code !== '23505') {
      console.error('Failed to insert external action:', error.message);
    }
  } catch (err) {
    if (err.code !== '23505') {
      console.error('Failed to record external action:', err.message);
    }
  }
}

// Check for existing idempotency key to prevent duplicates
async function checkDuplicateAction(idempotencyKey) {
  try {
    const { data } = await supabaseAdmin
      .from('external_actions')
      .select('external_id')
      .eq('idempotency_key', idempotencyKey)
      .single();
    return data ? data.external_id : null;
  } catch {
    return null;
  }
}

export const googleCalendarTools = {
  list_calendar_events: {
    name: 'list_calendar_events',
    description: 'Read calendar events within a bounded period.',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: 'google.calendar.read',
    declaration: {
      name: 'list_calendar_events',
      description: 'Read calendar events within a bounded period.',
      parameters: {
        type: 'OBJECT',
        properties: {
          calendarId: { type: 'STRING', description: 'Optional calendar ID. Defaults to "primary".' },
          timeMin: { type: 'STRING', description: 'ISO datetime for start of period.' },
          timeMax: { type: 'STRING', description: 'ISO datetime for end of period.' },
          maxResults: { type: 'INTEGER', description: 'Maximum number of results to return (default 20, max 50).' }
        },
        required: ['timeMin', 'timeMax']
      }
    },
    execute: async (args, context) => {
      const { user } = context;
      try {
        const events = await listEvents(user.id, args);
        if (context.isAi) {
          await logCalendarAction(user.id, 'ai', 'google_calendar_read', 'list_calendar_events', null, 'success');
        }
        return { success: true, events };
      } catch (error) {
        if (context.isAi) {
          await logCalendarAction(user.id, 'ai', 'google_calendar_read_failed', 'list_calendar_events', null, 'error');
        }
        return { success: false, error: error.message };
      }
    }
  },

  get_calendar_event: {
    name: 'get_calendar_event',
    description: 'Retrieve details for a specific calendar event.',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: 'google.calendar.read',
    declaration: {
      name: 'get_calendar_event',
      description: 'Retrieve details for a specific calendar event.',
      parameters: {
        type: 'OBJECT',
        properties: {
          calendarId: { type: 'STRING', description: 'Optional calendar ID. Defaults to "primary".' },
          eventId: { type: 'STRING', description: 'The Google Calendar event ID.' }
        },
        required: ['eventId']
      }
    },
    execute: async (args, context) => {
      const { calendarId, eventId } = args;
      const { user } = context;
      try {
        const event = await getEvent(user.id, eventId, calendarId);
        if (context.isAi) {
          await logCalendarAction(user.id, 'ai', 'google_calendar_read', 'get_calendar_event', eventId, 'success');
        }
        return { success: true, event };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  find_calendar_availability: {
    name: 'find_calendar_availability',
    description: 'Find available meeting slots for multiple participants within a time range. Generates a server-stored pending proposal for user confirmation.',
    riskLevel: TOOL_RISK_LEVELS.READ_ONLY,
    requiredPermission: 'google.calendar.read',
    declaration: {
      name: 'find_calendar_availability',
      description: 'Find available candidate meeting slots for multiple calendars/users within a time range and prepare proposal.',
      parameters: {
        type: 'OBJECT',
        properties: {
          calendarIds: { 
            type: 'ARRAY', 
            items: { type: 'STRING' },
            description: 'List of calendar IDs or attendee email addresses to check.'
          },
          timeMin: { type: 'STRING', description: 'ISO datetime for start of availability search (e.g. "2026-10-01T11:00:00+05:30").' },
          timeMax: { type: 'STRING', description: 'ISO datetime for end of availability search (e.g. "2026-10-01T12:00:00+05:30").' },
          durationMinutes: { type: 'INTEGER', description: 'Meeting duration in minutes (e.g. 30).' },
          timezone: { type: 'STRING', description: 'Timezone for the search. Defaults to Asia/Kolkata.' },
          summary: { type: 'STRING', description: 'Optional proposed meeting title (e.g. "Meeting with Priya Patel").' }
        },
        required: ['calendarIds', 'timeMin', 'timeMax', 'durationMinutes']
      }
    },
    execute: async (args, context) => {
      const { user } = context;
      const { calendarIds, timeMin, timeMax, durationMinutes, timezone, summary } = args;

      // Validate constraints
      if (!calendarIds || calendarIds.length < 1 || calendarIds.length > 10) {
        return { success: false, error: 'calendarIds must contain between 1 and 10 calendars.' };
      }
      if (durationMinutes < 15 || durationMinutes > 480) {
        return { success: false, error: 'durationMinutes must be between 15 and 480.' };
      }
      
      const tMin = new Date(timeMin);
      const tMax = new Date(timeMax);
      if (isNaN(tMin.getTime()) || isNaN(tMax.getTime())) {
        return { success: false, error: 'Invalid timeMin or timeMax ISO strings.' };
      }
      if (tMin >= tMax) {
        return { success: false, error: 'timeMin must be before timeMax.' };
      }
      if (tMax.getTime() - tMin.getTime() > 31 * 24 * 60 * 60 * 1000) {
        return { success: false, error: 'Time range cannot exceed 31 days.' };
      }

      try {
        const availability = await findAvailability(user.id, { calendarIds, timeMin, timeMax, timezone, durationMinutes });
        
        let pendingProposal = null;
        const slots = availability.availableCandidateSlots || [];

        // If at least one candidate slot is available, persist a server-authoritative pending proposal
        if (slots.length > 0) {
          const firstSlot = slots[0];
          const attendeeEmails = calendarIds.filter(id => id !== 'primary' && !id.includes('@group.calendar.google.com'));

          const payload = {
            provider: 'google_calendar',
            action: 'create_calendar_event',
            calendarId: 'primary',
            summary: summary || (attendeeEmails.length > 0 ? `Meeting with ${attendeeEmails[0]}` : 'Scheduled Meeting'),
            description: 'Scheduled via NEXUS AI after user confirmation.',
            start: firstSlot.start,
            end: firstSlot.end,
            timeZone: availability.timeZone || 'Asia/Kolkata',
            attendees: attendeeEmails,
            displayTime: firstSlot.displayTime,
            displayFull: firstSlot.displayFull,
          };

          const pendingAction = await aiPendingActionService.createPendingAction({
            userId: user.id,
            actionType: 'create_calendar_event',
            payload,
            expiresInMinutes: 15,
          });

          pendingProposal = {
            pendingActionId: pendingAction.id,
            expiresAt: pendingAction.expires_at,
            proposal: payload,
          };
        }

        if (context.isAi) {
          await logCalendarAction(
            user.id,
            'ai',
            'google_calendar_availability_checked',
            'find_calendar_availability',
            null,
            'success',
            { slotsFound: slots.length, pendingActionId: pendingProposal?.pendingActionId }
          );
        }

        return {
          success: true,
          timeZone: availability.timeZone,
          candidateSlots: slots,
          pendingProposal,
          summary: slots.length > 0
            ? `Found available slot: ${slots[0].displayFull}. Proposal created awaiting confirmation.`
            : 'No available slots found within the specified window.',
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },

  create_calendar_event: {
    name: 'create_calendar_event',
    description: 'Create a Google Calendar event. Must use server-validated event data or an authorized pendingActionId.',
    riskLevel: TOOL_RISK_LEVELS.EXTERNAL_WRITE,
    requiredPermission: 'google.calendar.write',
    declaration: {
      name: 'create_calendar_event',
      description: 'Create a calendar event in Google Calendar with explicit confirmation.',
      parameters: {
        type: 'OBJECT',
        properties: {
          pendingActionId: { type: 'STRING', description: 'ID of the authorized pending AI action.' },
          calendarId: { type: 'STRING', description: 'Optional calendar ID. Defaults to "primary".' },
          summary: { type: 'STRING', description: 'Event title.' },
          description: { type: 'STRING', description: 'Event description.' },
          start: { type: 'STRING', description: 'ISO datetime start with timezone offset (e.g. "2026-10-01T11:00:00+05:30").' },
          end: { type: 'STRING', description: 'ISO datetime end with timezone offset (e.g. "2026-10-01T11:30:00+05:30").' },
          timeZone: { type: 'STRING', description: 'Timezone for the event.' },
          attendees: { 
            type: 'ARRAY', 
            items: { type: 'STRING' },
            description: 'List of attendee email addresses.' 
          },
          location: { type: 'STRING', description: 'Event location.' }
        }
      }
    },
    execute: async (args, context) => {
      const { user } = context;
      let { pendingActionId, calendarId = 'primary', summary, description, start, end, timeZone, attendees, location } = args;

      let verifiedPendingRecord = null;

      // 1. If pendingActionId is provided, load the exact server-stored proposal
      if (pendingActionId) {
        verifiedPendingRecord = await aiPendingActionService.getPendingAction(pendingActionId, user.id);
        if (!verifiedPendingRecord) {
          return { success: false, error: 'Pending calendar action not found or expired.' };
        }
        if (verifiedPendingRecord.status !== 'pending' && verifiedPendingRecord.status !== 'confirmed') {
          return { success: false, error: `Pending action is in "${verifiedPendingRecord.status}" status and cannot be executed.` };
        }
        if (new Date(verifiedPendingRecord.expires_at) <= new Date()) {
          return { success: false, error: 'Pending calendar confirmation has expired (15 minute validity).' };
        }

        // Use exact stored server payload to prevent untrusted client tampering
        const payload = verifiedPendingRecord.payload;
        calendarId = payload.calendarId || calendarId;
        summary = payload.summary;
        description = payload.description;
        start = payload.start;
        end = payload.end;
        timeZone = payload.timeZone;
        attendees = payload.attendees;
        location = payload.location || location;
      }

      if (!summary || !start || !end) {
        return { success: false, error: 'Summary, start datetime, and end datetime are required.' };
      }

      const tStart = new Date(start);
      const tEnd = new Date(end);
      if (isNaN(tStart.getTime()) || isNaN(tEnd.getTime()) || tEnd <= tStart) {
        return { success: false, error: 'Event end time must be after start time.' };
      }

      // 2. Check Idempotency via external_actions
      const attendeeKey = (attendees || []).sort().join(',');
      const idempotencyKey = `google:${user.id}:create_event:${Buffer.from(summary).toString('base64')}:${start}:${end}:${Buffer.from(attendeeKey).toString('base64')}`;
      
      const existingId = await checkDuplicateAction(idempotencyKey);
      if (existingId) {
        console.log(`[Idempotency] Calendar event creation already processed for key: ${idempotencyKey}. ID: ${existingId}`);
        const existingEvent = await getEvent(user.id, existingId, calendarId);
        
        if (verifiedPendingRecord) {
          await aiPendingActionService.markCompleted(verifiedPendingRecord.id, user.id);
        }

        return {
          success: true,
          message: 'Returned existing event (idempotency matched, duplicate avoided).',
          event: existingEvent,
        };
      }

      // 3. Execute Google API Request
      try {
        const result = await createEvent(user.id, { calendarId, summary, description, start, end, timeZone, attendees, location });

        // Record in external_actions for idempotency and auditability
        await recordExternalAction({
          userId: user.id,
          actionType: 'create_calendar_event',
          idempotencyKey,
          externalId: result.id,
          status: 'success',
          requestMetadata: { summary, start, end, timeZone, attendees }
        });

        // Audit log
        if (context.isAi) {
          await logCalendarAction(user.id, 'ai', 'google_calendar_event_created', 'create_calendar_event', result.id, 'success');
        }

        // Mark pending action completed
        if (verifiedPendingRecord) {
          await aiPendingActionService.markCompleted(verifiedPendingRecord.id, user.id);
        }

        return {
          success: true,
          event: result,
          summary: `Successfully scheduled "${result.summary}" on ${result.displayFull || (start + ' to ' + end)}.`,
        };
      } catch (error) {
        if (context.isAi) {
          await logCalendarAction(user.id, 'ai', 'google_calendar_event_create_failed', 'create_calendar_event', null, 'error', { error: error.message });
        }
        return { success: false, error: error.message };
      }
    }
  }
};
