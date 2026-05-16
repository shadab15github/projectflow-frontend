import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const auth = useAuthStore();
    if (auth.token && config.headers) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { data } = await axios.post<{ token: string }>(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true }
  );
  return data.token;
}

function redirectToLogin(): void {
  const onAuthPage =
    window.location.pathname === '/login' || window.location.pathname === '/signup';
  if (!onAuthPage) {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const isRefreshCall = original?.url?.endsWith('/auth/refresh');

    if (status !== 401 || !original || original._retry || isRefreshCall) {
      if (status === 401) {
        useAuthStore().clearSession();
        redirectToLogin();
      }
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;

      const auth = useAuthStore();
      if (auth.user) {
        auth.setSession(auth.user, newToken);
      }

      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      useAuthStore().clearSession();
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  }
);

export default api;
