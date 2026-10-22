import axios from 'axios';
import { useAuthStore } from '../stores/auth-store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const csrfToken = useAuthStore.getState().csrfToken;
  if (
    csrfToken &&
    !['get', 'head', 'options'].includes(config.method?.toLowerCase() ?? 'get')
  ) {
    config.headers.set('X-CSRF-Token', csrfToken);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  },
);
