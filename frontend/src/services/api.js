import axios from 'axios';

import { supabase } from '../lib/supabase';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  if (!config.headers.Authorization) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        config.headers.Authorization = `Bearer ${data.session.access_token}`;
      }
    } catch (e) {
      // Supabase session read error ignored
    }
  }
  return config;
});

export const api = apiClient;
export default apiClient;

export const getHealth = async () => {
  const response = await apiClient.get('/api/health');
  return response.data;
};

export const getDatabaseHealth = async () => {
  const response = await apiClient.get('/api/health/database');
  return response.data;
};

export const getAiHealth = async () => {
  const response = await apiClient.get('/api/health/ai');
  return response.data;
};
