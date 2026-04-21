import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL as string,
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

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const auth = useAuthStore();
      auth.clearSession();
      const onAuthPage =
        window.location.pathname === '/login' || window.location.pathname === '/signup';
      if (!onAuthPage) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
