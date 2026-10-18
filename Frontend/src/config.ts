// Environment-based API and WebSocket configuration for PocketFarm Frontend

const getApiBaseUrl = (): string => {
  // 1. Check if explicitly defined via Vite environment variable (e.g. Vercel deployment)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }
  // 2. Default to local backend during development
  return 'http://127.0.0.1:5000';
};

const getSocketUrl = (): string => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL as string;
  }
  return getApiBaseUrl();
};

export const API_BASE_URL: string = getApiBaseUrl();
export const SOCKET_URL: string = getSocketUrl();

const config = {
  API_BASE_URL,
  SOCKET_URL,
  isProduction: import.meta.env.PROD,
};

export default config;
