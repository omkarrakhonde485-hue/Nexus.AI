// backend/src/integrations/google/googleCalendarService.js
// Production Google Calendar service with timezone management, freebusy querying, and event verification

import { google } from 'googleapis';
import { getGoogleClient } from './googleClientFactory.js';

// In-memory cache for user primary calendar timezones (TTL 1 hour)
const timezoneCache = new Map();

/**
 * Get an authenticated Calendar client for a user
 */
export async function getCalendarClient(userId) {
  const oAuth2Client = await getGoogleClient(userId);
  return google.calendar({ version: 'v3', auth: oAuth2Client });
}

/**
 * Get timezone offset string like "+05:30" or "-04:00" for a date in a given timeZone
 */
export function getTimezoneOffsetString(date, timeZone = 'Asia/Kolkata') {
  try {
    const str = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).format(date);
    const match = str.match(/GMT([+-]\d{2}:\d{2})?/);
    return match && match[1] ? match[1] : '+00:00';
  } catch {
    return '+05:30';
  }
}

/**
 * Format a Date to a timezone-aware ISO string: "2026-10-01T11:00:00+05:30"
 */
export function formatToLocalIso(date, timeZone = 'Asia/Kolkata') {
  const offset = getTimezoneOffsetString(date, timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const m = {};
  for (const p of parts) m[p.type] = p.value;
  const hour = m.hour === '24' ? '00' : m.hour;
  return `${m.year}-${m.month}-${m.day}T${hour}:${m.minute}:${m.second}${offset}`;
}

/**
 * Format date range to human readable local display time e.g. "11:00 AM – 11:30 AM IST"
 */
export function formatDisplaySlot(startDate, endDate, timeZone = 'Asia/Kolkata') {
  const tzAbbr = timeZone === 'Asia/Kolkata' ? 'IST' : timeZone;
  const timeOpts = { timeZone, hour: 'numeric', minute: '2-digit', hour12: true };
  const dateOpts = { timeZone, month: 'long', day: 'numeric', year: 'numeric' };

  const startStr = new Intl.DateTimeFormat('en-US', timeOpts).format(startDate);
  const endStr = new Intl.DateTimeFormat('en-US', timeOpts).format(endDate);
  const dateStr = new Intl.DateTimeFormat('en-US', dateOpts).format(startDate);

  return {
    displayDate: dateStr,
    displayTime: `${startStr} – ${endStr} ${tzAbbr}`,
    displayFull: `${dateStr} from ${startStr} to ${endStr} ${tzAbbr}`,
  };
}

/**
 * Determine user's primary calendar timezone with precedence:
 * 1. Explicit timezone
 * 2. Primary calendar timezone from Google
 * 3. Fallback: "Asia/Kolkata"
 */
export async function getUserCalendarTimezone(userId, explicitTimezone = null) {
  if (explicitTimezone && explicitTimezone.trim() !== '') {
    return explicitTimezone.trim();
  }

  if (userId && timezoneCache.has(userId)) {
    return timezoneCache.get(userId);
  }

  try {
    const calendar = await getCalendarClient(userId);
    const primaryCal = await calendar.calendars.get({ calendarId: 'primary' });
    if (primaryCal.data?.timeZone) {
      const tz = primaryCal.data.timeZone;
      timezoneCache.set(userId, tz);
      return tz;
    }
  } catch (err) {
    console.warn(`[Google Calendar] Could not fetch primary calendar timezone for user ${userId}:`, err.message);
  }

  return 'Asia/Kolkata';
}

/**
 * List events from a calendar
 */
export async function listEvents(userId, options = {}) {
  const calendar = await getCalendarClient(userId);
  const calendarId = options.calendarId || 'primary';
  const maxResults = Math.min(options.maxResults || 20, 50);

  const requestOptions = {
    calendarId,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
    showDeleted: false,
  };

  if (options.timeMin) requestOptions.timeMin = new Date(options.timeMin).toISOString();
  if (options.timeMax) requestOptions.timeMax = new Date(options.timeMax).toISOString();

  const res = await calendar.events.list(requestOptions);
  
  return (res.data.items || []).map(event => ({
    id: event.id,
    summary: event.summary,
    description: event.description,
    start: event.start,
    end: event.end,
    location: event.location,
    attendees: event.attendees,
    htmlLink: event.htmlLink,
    status: event.status,
    organizer: event.organizer,
  }));
}

/**
 * Get a single event
 */
export async function getEvent(userId, eventId, calendarId = 'primary') {
  const calendar = await getCalendarClient(userId);
  const res = await calendar.events.get({ calendarId, eventId });
  const event = res.data;
  return {
    id: event.id,
    summary: event.summary,
    description: event.description,
    start: event.start,
    end: event.end,
    location: event.location,
    attendees: event.attendees,
    htmlLink: event.htmlLink,
    status: event.status,
    organizer: event.organizer,
  };
}

/**
 * Find availability across multiple participants and generate candidate slots in user's timezone
 */
export async function findAvailability(userId, { calendarIds, timeMin, timeMax, timezone, durationMinutes }) {
  const calendar = await getCalendarClient(userId);
  const resolvedTimezone = await getUserCalendarTimezone(userId, timezone);
  
  const tMin = new Date(timeMin);
  const tMax = new Date(timeMax);
  if (isNaN(tMin.getTime()) || isNaN(tMax.getTime()) || tMin >= tMax) {
    throw new Error('timeMin must be a valid datetime before timeMax.');
  }

  const items = calendarIds.map(id => ({ id }));
  
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: tMin.toISOString(),
      timeMax: tMax.toISOString(),
      timeZone: resolvedTimezone,
      items,
    },
  });

  const calendars = res.data.calendars || {};
  
  // Flatten all busy blocks across all requested calendars
  const allBusy = [];
  for (const [calId, calData] of Object.entries(calendars)) {
    if (calData.busy) {
      calData.busy.forEach(b => {
        allBusy.push({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() });
      });
    }
  }

  // Sort busy blocks by start time
  allBusy.sort((a, b) => a.start - b.start);

  // Merge overlapping busy blocks
  const mergedBusy = [];
  if (allBusy.length > 0) {
    let current = allBusy[0];
    for (let i = 1; i < allBusy.length; i++) {
      if (allBusy[i].start <= current.end) {
        current.end = Math.max(current.end, allBusy[i].end);
      } else {
        mergedBusy.push(current);
        current = allBusy[i];
      }
    }
    mergedBusy.push(current);
  }

  const durationMs = durationMinutes * 60 * 1000;
  const startMs = tMin.getTime();
  const endMs = tMax.getTime();
  
  const freeSlots = [];
  let currentTime = startMs;

  for (const block of mergedBusy) {
    if (block.start > currentTime) {
      let availableStart = currentTime;
      while (availableStart + durationMs <= block.start) {
        const slotStart = new Date(availableStart);
        const slotEnd = new Date(availableStart + durationMs);
        const display = formatDisplaySlot(slotStart, slotEnd, resolvedTimezone);

        freeSlots.push({
          start: formatToLocalIso(slotStart, resolvedTimezone),
          end: formatToLocalIso(slotEnd, resolvedTimezone),
          timeZone: resolvedTimezone,
          displayDate: display.displayDate,
          displayTime: display.displayTime,
          displayFull: display.displayFull,
        });
        availableStart += durationMs;
      }
    }
    currentTime = Math.max(currentTime, block.end);
  }

  // Check remaining time after last busy block
  if (currentTime < endMs) {
    let availableStart = currentTime;
    while (availableStart + durationMs <= endMs) {
      const slotStart = new Date(availableStart);
      const slotEnd = new Date(availableStart + durationMs);
      const display = formatDisplaySlot(slotStart, slotEnd, resolvedTimezone);

      freeSlots.push({
        start: formatToLocalIso(slotStart, resolvedTimezone),
        end: formatToLocalIso(slotEnd, resolvedTimezone),
        timeZone: resolvedTimezone,
        displayDate: display.displayDate,
        displayTime: display.displayTime,
        displayFull: display.displayFull,
      });
      availableStart += durationMs;
    }
  }

  return {
    timeZone: resolvedTimezone,
    requestedCalendars: calendars,
    availableCandidateSlots: freeSlots,
  };
}

/**
 * Create a calendar event and verify its actual details from Google Calendar
 */
export async function createEvent(userId, { calendarId = 'primary', summary, description, start, end, timeZone, attendees, location }) {
  const calendar = await getCalendarClient(userId);
  const resolvedTz = await getUserCalendarTimezone(userId, timeZone);

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Valid start and end ISO datetimes are required.');
  }

  const startIso = formatToLocalIso(startDate, resolvedTz);
  const endIso = formatToLocalIso(endDate, resolvedTz);

  const eventBody = {
    summary: summary || 'Meeting Scheduled via NEXUS AI',
    description: description || 'Scheduled autonomously via NEXUS AI Operations Control Center.',
    start: {
      dateTime: startIso,
      timeZone: resolvedTz,
    },
    end: {
      dateTime: endIso,
      timeZone: resolvedTz,
    },
  };

  if (location) {
    eventBody.location = location;
  }
  
  if (attendees && Array.isArray(attendees) && attendees.length > 0) {
    eventBody.attendees = attendees.map(email => ({ email: typeof email === 'string' ? email : email.email }));
  }

  const insertRes = await calendar.events.insert({
    calendarId,
    requestBody: eventBody,
  });

  const createdId = insertRes.data.id;

  // Retrieve and verify actual created event from Google API
  const verifiedRes = await calendar.events.get({
    calendarId,
    eventId: createdId,
  });

  const verified = verifiedRes.data;
  const display = formatDisplaySlot(new Date(verified.start.dateTime || verified.start.date), new Date(verified.end.dateTime || verified.end.date), resolvedTz);

  return {
    id: verified.id,
    summary: verified.summary,
    description: verified.description,
    start: verified.start,
    end: verified.end,
    timeZone: resolvedTz,
    htmlLink: verified.htmlLink,
    status: verified.status,
    attendees: verified.attendees,
    displayTime: display.displayTime,
    displayFull: display.displayFull,
    verified: true,
  };
}
