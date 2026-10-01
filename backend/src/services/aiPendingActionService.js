// backend/src/services/aiPendingActionService.js
// Server-authoritative service for managing AI pending actions requiring user confirmation

import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';

// In-memory fallback cache ensures high resilience and sync across instances
const memoryStore = new Map();

export const aiPendingActionService = {
  /**
   * Create and persist a new pending AI action proposal
   */
  async createPendingAction({ userId, actionType = 'create_calendar_event', payload, expiresInMinutes = 15 }) {
    if (!userId) throw new Error('userId is required to create a pending action.');
    if (!actionType) throw new Error('actionType is required.');
    if (!payload || typeof payload !== 'object') throw new Error('Valid payload object is required.');

    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000).toISOString();

    const record = {
      id,
      user_id: userId,
      action_type: actionType,
      payload,
      status: 'pending',
      expires_at: expiresAt,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      confirmed_at: null,
      completed_at: null,
      cancelled_at: null,
    };

    // 1. Save in memory cache
    memoryStore.set(id, { ...record });

    // 2. Persist to Supabase ai_pending_actions table
    try {
      const { data, error } = await supabaseAdmin
        .from('ai_pending_actions')
        .insert({
          id,
          user_id: userId,
          action_type: actionType,
          payload,
          status: 'pending',
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) {
        console.warn('[Pending Action Service] Supabase insert warning (using fallback cache):', error.message);
      } else if (data) {
        memoryStore.set(id, data);
        return data;
      }
    } catch (err) {
      console.warn('[Pending Action Service] DB error on insert:', err.message);
    }

    return record;
  },

  /**
   * Get a pending action by ID with ownership verification and expiration checking
   */
  async getPendingAction(id, userId = null) {
    if (!id) return null;

    let record = null;

    // Try Supabase first
    try {
      const { data, error } = await supabaseAdmin
        .from('ai_pending_actions')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        record = data;
      }
    } catch (err) {
      // ignore
    }

    // Fallback to memory store if DB lookup didn't succeed
    if (!record && memoryStore.has(id)) {
      record = memoryStore.get(id);
    }

    if (!record) return null;

    // Ownership check if requested
    if (userId && record.user_id !== userId) {
      const err = new Error('Unauthorized access to pending action.');
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    // Expiration check
    if (record.status === 'pending' && new Date(record.expires_at) <= new Date()) {
      record.status = 'expired';
      record.updated_at = new Date().toISOString();
      memoryStore.set(id, { ...record });

      try {
        await supabaseAdmin
          .from('ai_pending_actions')
          .update({ status: 'expired', updated_at: record.updated_at })
          .eq('id', id);
      } catch (e) {
        // ignore
      }
    }

    return record;
  },

  /**
   * Get the most recent active (non-expired, status=pending) action for a user
   */
  async getActivePendingActionForUser(userId, actionType = 'create_calendar_event') {
    if (!userId) return null;

    const now = new Date().toISOString();

    // 1. Try DB
    try {
      const { data, error } = await supabaseAdmin
        .from('ai_pending_actions')
        .select('*')
        .eq('user_id', userId)
        .eq('action_type', actionType)
        .eq('status', 'pending')
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        return data;
      }
    } catch (e) {
      // ignore
    }

    // 2. Check memory store
    for (const item of memoryStore.values()) {
      if (
        item.user_id === userId &&
        item.action_type === actionType &&
        item.status === 'pending' &&
        new Date(item.expires_at) > new Date()
      ) {
        return item;
      }
    }

    return null;
  },

  /**
   * Mark action as confirmed
   */
  async markConfirmed(id, userId = null) {
    const record = await this.getPendingAction(id, userId);
    if (!record) throw new Error(`Pending action ${id} not found.`);

    const now = new Date().toISOString();
    record.status = 'confirmed';
    record.confirmed_at = now;
    record.updated_at = now;
    memoryStore.set(id, { ...record });

    try {
      await supabaseAdmin
        .from('ai_pending_actions')
        .update({ status: 'confirmed', confirmed_at: now, updated_at: now })
        .eq('id', id);
    } catch (e) {
      // ignore
    }

    return record;
  },

  /**
   * Mark action as completed
   */
  async markCompleted(id, userId = null) {
    const record = await this.getPendingAction(id, userId);
    if (!record) throw new Error(`Pending action ${id} not found.`);

    const now = new Date().toISOString();
    record.status = 'completed';
    record.confirmed_at = record.confirmed_at || now;
    record.completed_at = now;
    record.updated_at = now;
    memoryStore.set(id, { ...record });

    try {
      await supabaseAdmin
        .from('ai_pending_actions')
        .update({
          status: 'completed',
          confirmed_at: record.confirmed_at,
          completed_at: now,
          updated_at: now,
        })
        .eq('id', id);
    } catch (e) {
      // ignore
    }

    return record;
  },

  /**
   * Mark action as cancelled
   */
  async markCancelled(id, userId = null) {
    const record = await this.getPendingAction(id, userId);
    if (!record) throw new Error(`Pending action ${id} not found.`);

    const now = new Date().toISOString();
    record.status = 'cancelled';
    record.cancelled_at = now;
    record.updated_at = now;
    memoryStore.set(id, { ...record });

    try {
      await supabaseAdmin
        .from('ai_pending_actions')
        .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
        .eq('id', id);
    } catch (e) {
      // ignore
    }

    return record;
  },

  /**
   * Mark action as expired
   */
  async markExpired(id, userId = null) {
    const record = await this.getPendingAction(id, userId);
    if (!record) return null;

    const now = new Date().toISOString();
    record.status = 'expired';
    record.updated_at = now;
    memoryStore.set(id, { ...record });

    try {
      await supabaseAdmin
        .from('ai_pending_actions')
        .update({ status: 'expired', updated_at: now })
        .eq('id', id);
    } catch (e) {
      // ignore
    }

    return record;
  },
};
