import api from './api';
import type { AuthResponse, LoginPayload, SignupPayload } from '@/types';

export async function register(payload: SignupPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function refresh(): Promise<{ token: string }> {
  const { data } = await api.post<{ token: string }>('/auth/refresh');
  return data;
}
