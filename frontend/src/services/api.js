import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
