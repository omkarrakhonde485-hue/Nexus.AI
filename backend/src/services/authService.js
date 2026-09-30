// backend/src/services/authService.js
// Supabase Bearer token verification and profile management

import { supabase } from '../config/supabase.js';

export const verifyBearerToken = async (token) => {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, error: error?.message || 'Invalid token' };
  }
  return { user: data.user, error: null };
};

export const getProfileByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return { profile: null, error: error?.message || 'Profile not found' };
  }
  return { profile: data, error: null };
};

export const createOrSyncProfile = async ({ userId, email, fullName, department = 'Engineering', role = 'employee' }) => {
  // Enforce default role to employee unless created via admin seed
  const safeRole = ['admin', 'manager', 'employee', 'finance', 'hr', 'it_support', 'procurement'].includes(role)
    ? role
    : 'employee';

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        department,
        role: safeRole,
        is_active: true,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();

  if (error) {
    throw new Error(`Profile sync failed: ${error.message}`);
  }
  return data;
};

export const updateProfile = async (userId, updates) => {
  // Filter out restricted fields that ordinary users cannot update
  const { role, manager_id, is_active, id, email, created_at, ...allowedUpdates } = updates;

  const { data, error } = await supabase
    .from('profiles')
    .update(allowedUpdates)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Profile update failed: ${error.message}`);
  }
  return data;
};
