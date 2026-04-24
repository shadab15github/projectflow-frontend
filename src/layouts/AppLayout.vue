<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';

const auth = useAuthStore();
const tenantStore = useTenantStore();
const { tenant, loading } = storeToRefs(tenantStore);

onMounted(async () => {
  if (auth.isAuthenticated && !tenant.value) {
    try {
      await tenantStore.fetchTenant();
    } catch {
      // api interceptor handles 401; other errors are non-fatal for layout
    }
  }
});
</script>

<template>
  <div class="min-h-screen flex">
    <aside class="w-60 border-r bg-background p-4">
      <div class="font-semibold mb-6">ProjectFlow</div>
      <nav class="flex flex-col gap-1 text-sm">
        <RouterLink to="/app" class="px-2 py-1.5 rounded hover:bg-accent">Dashboard</RouterLink>
      </nav>
    </aside>
    <div class="flex-1 flex flex-col">
      <header class="h-14 border-b flex items-center justify-between px-4">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">Workspace:</span>
          <span class="text-sm font-medium">
            {{ tenant ? tenant.name : loading ? 'Loading…' : '—' }}
          </span>
        </div>
      </header>
      <main class="flex-1 p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
