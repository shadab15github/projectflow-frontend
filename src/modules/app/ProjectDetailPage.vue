<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { VsxIcon } from 'vue-iconsax';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/project';
import { useWorkItemStore } from '@/store/workItem';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CreateWorkItemDialog from './CreateWorkItemDialog.vue';
import EditProjectDialog from './project/EditProjectDialog.vue';
import { projectContextKey } from './project/projectContext';

interface TabDef {
  name: string;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { name: 'project-summary', label: 'Summary', icon: 'Global' },
  { name: 'project-backlog', label: 'Backlog', icon: 'DocumentText' },
  { name: 'project-board', label: 'Board', icon: 'Element4' },
  { name: 'project-list', label: 'List', icon: 'RowVertical' },
  { name: 'project-timeline', label: 'Timeline', icon: 'Calendar' },
  { name: 'project-components', label: 'Components', icon: 'Diagram' },
  { name: 'project-docs', label: 'Docs', icon: 'DocumentText' },
];

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const projectStore = useProjectStore();
const workItemStore = useWorkItemStore();

const project = ref<Project | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);

const tasksLoading = ref(false);
const tasksError = ref<string | null>(null);

const createOpen = ref(false);
const editOpen = ref(false);
const deleting = ref(false);
const deleteError = ref<string | null>(null);

const projectSlug = computed<string>(() => route.params.slug as string);
const projectId = computed<string>(() => project.value?._id ?? '');

const canEdit = computed<boolean>(() => {
  const role = auth.user?.role;
  return role === 'manager' || role === 'admin' || role === 'super_admin';
});

const canCreateTask = computed<boolean>(() => canEdit.value);

const canDelete = computed<boolean>(() => {
  const role = auth.user?.role;
  return role === 'admin' || role === 'super_admin';
});

const projectInitials = computed<string>(() => {
  const name = project.value?.name?.trim() ?? '';
  if (!name) return 'P';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
});

async function reload(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    project.value = await projectStore.fetchProject(projectSlug.value);
    await reloadItems();
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      loadError.value = 'Project not found.';
    } else {
      loadError.value = 'Failed to load project.';
    }
  } finally {
    loading.value = false;
  }
}

async function reloadItems(): Promise<void> {
  if (!projectId.value) return;
  tasksLoading.value = true;
  tasksError.value = null;
  try {
    await workItemStore.fetchItems({ projectId: projectId.value });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      tasksError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        'Failed to load work items.';
    } else {
      tasksError.value = 'Failed to load work items.';
    }
  } finally {
    tasksLoading.value = false;
  }
}

function openCreateTask(): void {
  createOpen.value = true;
}

function onItemCreated(): void {
  void reloadItems();
}

function onProjectSaved(): void {
  if (projectStore.currentProject) {
    project.value = projectStore.currentProject;
  }
}

async function onDelete(): Promise<void> {
  if (!project.value) return;
  const confirmed = window.confirm(
    `Delete "${project.value.name}"? This cannot be undone.`,
  );
  if (!confirmed) return;

  deleting.value = true;
  deleteError.value = null;
  try {
    await projectStore.deleteProject(project.value._id);
    await router.replace({ name: 'dashboard' });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      deleteError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        'Failed to delete project.';
    } else {
      deleteError.value = 'Unexpected error. Please try again.';
    }
  } finally {
    deleting.value = false;
  }
}

onMounted(reload);
watch(projectSlug, reload);

provide(projectContextKey, {
  project,
  loading,
  tasksLoading,
  tasksError,
  canEdit,
  canCreateTask,
  canDelete,
  reload,
  reloadTasks: reloadItems,
  openCreateTask,
});
</script>

<template>
  <section class="flex flex-col">
    <div
      v-if="loading && !project"
      class="p-6 text-sm text-muted-foreground"
    >
      Loading project…
    </div>

    <div v-else-if="loadError" class="flex flex-col gap-3 p-6">
      <p class="text-sm text-destructive">{{ loadError }}</p>
      <Button variant="outline" @click="router.replace({ name: 'dashboard' })">
        Back to dashboard
      </Button>
    </div>

    <template v-else-if="project">
      <!-- Top bar -->
      <div class="flex flex-col gap-3 px-6 pt-5 pb-3">
        <RouterLink
          to="/app"
          class="text-xs text-muted-foreground hover:underline w-fit"
        >
          Spaces
        </RouterLink>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <Avatar class="size-8 rounded-md">
              <AvatarFallback
                class="rounded-md bg-primary text-primary-foreground text-xs font-semibold"
              >
                {{ projectInitials }}
              </AvatarFallback>
            </Avatar>
            <h1 class="text-xl font-semibold truncate">{{ project.name }}</h1>
            <span
              class="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground"
            >
              {{ project.key }}
            </span>

            <Button
              variant="ghost"
              size="icon-sm"
              class="border"
              aria-label="Invite people"
            >
              <VsxIcon iconName="UserAdd" class="size-4" />
            </Button>

            <DropdownMenu v-if="canEdit || canDelete">
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon-sm" aria-label="More">
                  <VsxIcon iconName="More" class="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" class="min-w-44">
                <DropdownMenuItem
                  v-if="canEdit"
                  class="gap-2"
                  @select="editOpen = true"
                >
                  <VsxIcon iconName="Edit" class="size-4" />
                  <span>Edit project</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator v-if="canEdit && canDelete" />
                <DropdownMenuItem
                  v-if="canDelete"
                  variant="destructive"
                  class="gap-2"
                  :disabled="deleting"
                  @select="onDelete"
                >
                  <VsxIcon iconName="Trash" class="size-4" />
                  <span>{{ deleting ? 'Deleting…' : 'Delete project' }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div class="flex items-center gap-2">
            <Button
              v-if="canCreateTask"
              size="sm"
              class="gap-1.5"
              @click="openCreateTask"
            >
              <VsxIcon iconName="Add" class="size-4" />
              Create
            </Button>
          </div>
        </div>

        <p v-if="deleteError" class="text-sm text-destructive">
          {{ deleteError }}
        </p>
      </div>

      <!-- Tabs -->
      <nav
        class="px-6 border-b flex items-center gap-1 overflow-x-auto"
        aria-label="Project sections"
      >
        <RouterLink
          v-for="tab in TABS"
          :key="tab.name"
          :to="{ name: tab.name, params: { slug: projectSlug } }"
          class="flex items-center gap-1.5 px-3 py-3 text-sm whitespace-nowrap border-b-2 border-transparent text-muted-foreground hover:text-foreground"
          active-class="!border-primary !text-foreground font-medium"
        >
          <VsxIcon :iconName="tab.icon" class="size-4" />
          <span>{{ tab.label }}</span>
        </RouterLink>
      </nav>

      <div class="p-6">
        <RouterView />
      </div>

      <CreateWorkItemDialog
        v-if="project"
        v-model:open="createOpen"
        :project="project"
        @created="onItemCreated"
      />

      <EditProjectDialog
        v-model:open="editOpen"
        :project="project"
        @saved="onProjectSaved"
      />
    </template>
  </section>
</template>
