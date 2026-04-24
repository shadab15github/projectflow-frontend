import api from './api';
import type { Tenant } from '@/types';

export async function getCurrentTenant(): Promise<Tenant> {
  const { data } = await api.get<{ tenant: Tenant }>('/tenant/me');
  return data.tenant;
}
