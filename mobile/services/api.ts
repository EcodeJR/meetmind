import axios from 'axios';

const FALLBACK_API_URL = 'https://memovoice.onrender.com/api';

const normalizeApiUrl = (rawUrl?: string): string => {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return FALLBACK_API_URL;
  }

  try {
    const parsed = new URL(trimmed);
    const cleanPath = parsed.pathname.replace(/\/+$/, '');

    if (!cleanPath || cleanPath === '/') {
      parsed.pathname = '/api';
    } else if (!cleanPath.endsWith('/api')) {
      parsed.pathname = `${cleanPath}/api`;
    } else {
      parsed.pathname = cleanPath;
    }

    return parsed.toString().replace(/\/+$/, '');
  } catch {
    // Keep the raw value if URL parsing fails (e.g., custom dev host format).
    return trimmed;
  }
};

const API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);

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
