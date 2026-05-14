import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://[IP_ADDRESS]/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30-second timeout to prevent hanging requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Store token getter function that will be set by the app
let getTokenFn: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

// Add auth token interceptor
apiClient.interceptors.request.use(
  async (config) => {
    try {
      if (getTokenFn) {
        const token = await getTokenFn();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error('Error retrieving token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[API] Received 401 Unauthorized - user session may be invalid');
      // Don't automatically log out here - let the app handle it
    }
    if (error.config?.url) {
      console.error(`[API Error] ${error.config.method?.toUpperCase()} ${error.config.url}: ${error.response?.status || error.code}`);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
