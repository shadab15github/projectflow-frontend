<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { useProjectStore } from '@/store/project';

const auth = useAuthStore();
const tenantStore = useTenantStore();
const projectStore = useProjectStore();
const { tenant, loading: tenantLoading } = storeToRefs(tenantStore);
const { recentProjects } = storeToRefs(projectStore);

onMounted(async () => {
  if (!auth.isAuthenticated) return;

  const tasks: Promise<unknown>[] = [];
  if (!tenant.value) tasks.push(tenantStore.fetchTenant());
  if (projectStore.projects.length === 0)
    tasks.push(projectStore.fetchProjects());

  try {
    await Promise.all(tasks);
  } catch {
    // api interceptor handles 401; other errors are non-fatal for layout
  }
});

function logout(): void {
  auth.logout();
  projectStore.clear();
  window.location.href = '/login';
}
</script>

<template>
  <div class="min-h-screen flex">
    <aside class="w-60 border-r bg-background p-4 flex flex-col gap-6">
      <div class="font-semibold">ProjectFlow</div>
      <nav class="flex flex-col gap-1 text-sm">
        <RouterLink
          to="/app"
          class="px-2 py-1.5 rounded hover:bg-accent"
          active-class="bg-accent font-medium"
        >
          Projects
        </RouterLink>
      </nav>

      <div v-if="recentProjects.length > 0" class="flex flex-col gap-2">
        <p class="px-2 text-xs uppercase tracking-wide text-muted-foreground">
          Recent
        </p>
        <nav class="flex flex-col gap-0.5 text-sm">
          <RouterLink
            v-for="project in recentProjects"
            :key="project._id"
            :to="{ name: 'project-detail', params: { id: project._id } }"
            class="px-2 py-1 rounded truncate hover:bg-accent"
            active-class="bg-accent font-medium"
          >
            {{ project.name }}
          </RouterLink>
        </nav>
      </div>
    </aside>

    <div class="flex-1 flex flex-col">
      <header class="h-14 border-b flex items-center justify-between px-4">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">Workspace:</span>
          <span class="text-sm font-medium">
            {{ tenant ? tenant.name : tenantLoading ? 'Loading…' : '—' }}
          </span>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="auth.user" class="text-sm text-muted-foreground">
            {{ auth.user.name }}
          </span>
          <button
            type="button"
            class="text-sm underline underline-offset-4 hover:text-foreground"
            @click="logout"
          >
            Sign out
          </button>
        </div>
      </header>
      <main class="flex-1 p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
