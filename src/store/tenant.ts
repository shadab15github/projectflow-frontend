import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Tenant } from '@/types';
import * as tenantService from '@/services/tenant.service';

export const useTenantStore = defineStore('tenant', () => {
  const tenant = ref<Tenant | null>(null);
  const loading = ref(false);

  async function fetchTenant(): Promise<void> {
    loading.value = true;
    try {
      tenant.value = await tenantService.getCurrentTenant();
    } finally {
      loading.value = false;
    }
  }

  function clearTenant(): void {
    tenant.value = null;
  }

  return { tenant, loading, fetchTenant, clearTenant };
});
