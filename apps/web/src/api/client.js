import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '';

let accessToken = null;
let onUnauthorized = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    if (response?.status === 401 && !config._retry && !config.url?.includes('/auth/')) {
      config._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const { data } = await refreshPromise;
        setAccessToken(data.accessToken);
        config.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(config);
      } catch (refreshErr) {
        setAccessToken(null);
        onUnauthorized?.();
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
