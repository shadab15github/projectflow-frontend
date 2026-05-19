import { useQuery } from '@tanstack/vue-query';
import type { Tenant } from '@/types';
import * as tenantService from '@/services/tenant.service';

export const tenantKeys = {
  all: ['tenant'] as const,
  current: () => [...tenantKeys.all, 'me'] as const,
};

export function useCurrentTenant() {
  return useQuery<Tenant>({
    queryKey: tenantKeys.current(),
    queryFn: tenantService.getCurrentTenant,
  });
}
