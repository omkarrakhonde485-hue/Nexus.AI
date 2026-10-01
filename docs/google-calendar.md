# Google Calendar Integration (Block 8)

## Overview
The NEXUS AI Google Calendar integration allows the agent to check availability, query events, and create calendar events natively within the user's Google Calendar.

## Architecture
- **googleCalendarService.js**: Implements calendar primitives (`listEvents`, `getEvent`, `findAvailability`, `createEvent`) over the real Google API.
- **googleCalendarTools.js**: Exposes these primitives as tool capabilities to Gemini, bound to read and write risk levels.
- **toolRegistry**: Exposes tools for AI use.
- **Idempotency**: External action creations use deterministic Base64 hashing of core event properties to guarantee duplicate requests do not create duplicate events.

## Permissions & Scope
Relies entirely on the existing `https://www.googleapis.com/auth/calendar` scope authorized in Block 6.

## Tool Contracts
1. `list_calendar_events`: Bounded querying for events within an ISO window. Defaults to the user's primary calendar.
2. `get_calendar_event`: Fetches comprehensive details for a known event ID.
3. `find_calendar_availability`: Uses `freebusy.query` across multiple users/calendars. It flattens all busy time arrays into a candidate pool of free slots based on the desired duration. The server returns these candidate slots so the AI doesn't have to perform math logic.
4. `create_calendar_event`: Modifies the user's calendar directly. Protected by an explicit confirmation gate and external action auditing.

## Security & Auditing
- **Read Only operations**: Logged passively to `activity_logs`.
- **Write operations**: Logged critically to `external_actions`. Requires the `google.calendar.write` system permission tag (even though OAuth inherently allows it) to pass tool execution filters.

## AI Guardrails
- The AI is instructed to propose candidate meeting times using `find_calendar_availability`.
- It cannot invent slots.
- It cannot assume confirmation unless an explicit user prompt permits scheduling.

## Demo Flow
1. User: "Schedule a 30 minute review with Rahul tomorrow afternoon."
2. AI: Identifies parameters, calls `find_calendar_availability`.
3. AI returns a proposed slot: "I found a free slot at 2:00 PM tomorrow. Should I schedule it?"
4. User: "Yes."
5. AI: Calls `create_calendar_event`, triggering Google Calendar API insertion and idempotency auditing.
