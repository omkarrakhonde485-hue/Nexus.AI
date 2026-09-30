// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiClient } from '../services/api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Synchronize profile and permissions from Render Backend
  const refreshProfile = async (currentSession) => {
    const activeSession = currentSession || session;
    if (!activeSession?.access_token) {
      setProfile(null);
      setPermissions([]);
      return;
    }

    try {
      const response = await apiClient.get('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${activeSession.access_token}`,
        },
      });

      if (response.data?.success) {
        setProfile(response.data.data.profile);
        setPermissions(response.data.data.permissions || []);
      }
    } catch (err) {
      console.error('Failed to sync profile from backend:', err);
      // Handle 401 token invalidation
      if (err.response?.status === 401) {
        await signOut();
      }
    }
  };

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user || null);
      if (initialSession) {
        refreshProfile(initialSession).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);
      if (newSession) {
        await refreshProfile(newSession);
      } else {
        setProfile(null);
        setPermissions([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign In with Email & Password
  const signIn = async (email, password) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      throw error;
    }
    return data;
  };

  // Sign Up with Email & Password
  const signUp = async (email, password, fullName, department) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      throw error;
    }

    if (data.session) {
      // Sync initial employee profile with backend
      await apiClient.post(
        '/api/auth/profile',
        { fullName, department },
        { headers: { Authorization: `Bearer ${data.session.access_token}` } }
      );
    }

    setLoading(false);
    return data;
  };

  // Sign Out
  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setPermissions([]);
    setLoading(false);
  };

  const hasPermission = (permissionKey) => {
    return permissions.includes(permissionKey);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        permissions,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
