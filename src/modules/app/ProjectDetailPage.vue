<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/project';
import { useTaskStore } from '@/store/task';
import type { Project, Task, TaskPriority, TaskState } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import CreateTaskDialog from './CreateTaskDialog.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const projectStore = useProjectStore();
const taskStore = useTaskStore();

const project = ref<Project | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);

const tasksLoading = ref(false);
const tasksError = ref<string | null>(null);
const createTaskOpen = ref(false);
const taskFilter = ref<TaskState | 'ALL'>('ALL');

const STATE_OPTIONS: { value: TaskState | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'DONE', label: 'Done' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATE_LABELS: Record<TaskState, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
  BLOCKED: 'Blocked',
  CANCELLED: 'Cancelled',
};

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-800',
};

const editing = ref(false);
const editName = ref('');
const editDescription = ref('');
const saveError = ref<string | null>(null);
const saving = ref(false);
const deleteError = ref<string | null>(null);
const deleting = ref(false);

const canEdit = computed<boolean>(() => {
  const role = auth.user?.role;
  return role === 'manager' || role === 'admin' || role === 'super_admin';
});

const canCreateTask = computed<boolean>(() => canEdit.value);

const canDelete = computed<boolean>(() => {
  const role = auth.user?.role;
  return role === 'admin' || role === 'super_admin';
});

const projectId = computed<string>(() => route.params.id as string);

const visibleTasks = computed<Task[]>(() => {
  if (taskFilter.value === 'ALL') return taskStore.tasks;
  return taskStore.tasks.filter((t) => t.state === taskFilter.value);
});

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    project.value = await projectStore.fetchProject(projectId.value);
    await loadTasks();
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

async function loadTasks(): Promise<void> {
  tasksLoading.value = true;
  tasksError.value = null;
  try {
    await taskStore.fetchTasks({ projectId: projectId.value });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      tasksError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        'Failed to load tasks.';
    } else {
      tasksError.value = 'Failed to load tasks.';
    }
  } finally {
    tasksLoading.value = false;
  }
}

function onTaskCreated(): void {
  void loadTasks();
}

function openTask(taskId: string): void {
  void router.push({ name: 'task-detail', params: { id: taskId } });
}

onMounted(load);
watch(projectId, load);

function startEdit(): void {
  if (!project.value) return;
  editName.value = project.value.name;
  editDescription.value = project.value.description;
  saveError.value = null;
  editing.value = true;
}

function cancelEdit(): void {
  editing.value = false;
  saveError.value = null;
}

async function save(): Promise<void> {
  if (!project.value) return;
  if (editName.value.trim().length < 2) {
    saveError.value = 'Name must be at least 2 characters';
    return;
  }

  saving.value = true;
  saveError.value = null;
  try {
    const updated = await projectStore.updateProject(project.value._id, {
      name: editName.value.trim(),
      description: editDescription.value.trim(),
    });
    project.value = updated;
    editing.value = false;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      saveError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        'Failed to save changes.';
    } else {
      saveError.value = 'Unexpected error. Please try again.';
    }
  } finally {
    saving.value = false;
  }
}

async function remove(): Promise<void> {
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <div v-if="loading && !project" class="text-sm text-muted-foreground">
      Loading project…
    </div>

    <div v-else-if="loadError" class="flex flex-col gap-3">
      <p class="text-sm text-destructive">{{ loadError }}</p>
      <Button variant="outline" @click="router.replace({ name: 'dashboard' })">
        Back to dashboard
      </Button>
    </div>

    <template v-else-if="project">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold">{{ project.name }}</h1>
          <p class="text-sm text-muted-foreground">
            Created {{ formatDate(project.createdAt) }} · Updated
            {{ formatDate(project.updatedAt) }}
          </p>
        </div>
        <div class="flex gap-2">
          <Button v-if="canEdit && !editing" variant="outline" @click="startEdit">
            Edit
          </Button>
          <Button
            v-if="canDelete"
            variant="destructive"
            :disabled="deleting"
            @click="remove"
          >
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </Button>
        </div>
      </header>

      <p v-if="deleteError" class="text-sm text-destructive">
        {{ deleteError }}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Project name and description.</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <template v-if="editing">
            <div class="flex flex-col gap-2">
              <Label for="edit-name">Name</Label>
              <Input id="edit-name" v-model="editName" :disabled="saving" />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                v-model="editDescription"
                rows="4"
                :disabled="saving"
              />
            </div>
            <p v-if="saveError" class="text-sm text-destructive">
              {{ saveError }}
            </p>
            <div class="flex gap-2">
              <Button type="button" :disabled="saving" @click="save">
                {{ saving ? 'Saving…' : 'Save changes' }}
              </Button>
              <Button
                type="button"
                variant="outline"
                :disabled="saving"
                @click="cancelEdit"
              >
                Cancel
              </Button>
            </div>
          </template>
          <template v-else>
            <p class="text-sm">
              {{
                project.description
                  ? project.description
                  : 'No description provided.'
              }}
            </p>
            <p class="text-xs text-muted-foreground">
              Status: <span class="font-medium">{{ project.status }}</span>
            </p>
          </template>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {{ project.members.length }} member{{
              project.members.length === 1 ? '' : 's'
            }}
            on this project.
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <p
            v-if="project.members.length === 0"
            class="text-sm text-muted-foreground"
          >
            No members yet.
          </p>
          <ul v-else class="flex flex-col gap-1 text-sm">
            <li
              v-for="memberId in project.members"
              :key="memberId"
              class="font-mono text-xs"
            >
              {{ memberId }}
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>
              {{ visibleTasks.length }} of {{ taskStore.tasks.length }} task{{
                taskStore.tasks.length === 1 ? '' : 's'
              }}.
            </CardDescription>
          </div>
          <Button
            v-if="canCreateTask"
            type="button"
            @click="createTaskOpen = true"
          >
            + New task
          </Button>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="opt in STATE_OPTIONS"
              :key="opt.value"
              type="button"
              size="sm"
              :variant="taskFilter === opt.value ? 'default' : 'outline'"
              @click="taskFilter = opt.value"
            >
              {{ opt.label }}
            </Button>
          </div>

          <p v-if="tasksError" class="text-sm text-destructive">
            {{ tasksError }}
          </p>

          <p
            v-if="tasksLoading && taskStore.tasks.length === 0"
            class="text-sm text-muted-foreground"
          >
            Loading tasks…
          </p>

          <p
            v-else-if="taskStore.tasks.length === 0"
            class="text-sm text-muted-foreground"
          >
            No tasks yet. {{ canCreateTask ? 'Create the first one.' : '' }}
          </p>

          <p
            v-else-if="visibleTasks.length === 0"
            class="text-sm text-muted-foreground"
          >
            No tasks match the selected filter.
          </p>

          <ul v-else class="flex flex-col gap-2">
            <li
              v-for="task in visibleTasks"
              :key="task._id"
              class="flex cursor-pointer items-start justify-between gap-4 rounded-md border bg-card p-3 hover:bg-accent/40"
              @click="openTask(task._id)"
            >
              <div class="flex flex-col gap-1">
                <p class="text-sm font-medium">{{ task.title }}</p>
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    class="rounded bg-muted px-2 py-0.5 text-muted-foreground"
                  >
                    {{ STATE_LABELS[task.state] }}
                  </span>
                  <span
                    :class="[
                      'rounded px-2 py-0.5 capitalize',
                      PRIORITY_CLASSES[task.priority],
                    ]"
                  >
                    {{ task.priority }}
                  </span>
                  <span
                    v-if="task.assigneeId"
                    class="font-mono text-muted-foreground"
                  >
                    @{{ task.assigneeId.slice(-6) }}
                  </span>
                  <span
                    v-for="label in task.labels"
                    :key="label"
                    class="rounded border px-2 py-0.5 text-muted-foreground"
                  >
                    {{ label }}
                  </span>
                </div>
              </div>
              <span class="text-xs text-muted-foreground whitespace-nowrap">
                {{ formatDate(task.updatedAt) }}
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <CreateTaskDialog
        v-model:open="createTaskOpen"
        :project-id="projectId"
        :project-members="project.members"
        @created="onTaskCreated"
      />
    </template>
  </section>
</template>
