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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const projectStore = useProjectStore();
const taskStore = useTaskStore();

const taskId = computed<string>(() => route.params.id as string);

const task = ref<Task | null>(null);
const project = ref<Project | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);

const editing = ref(false);
const editTitle = ref('');
const editDescription = ref('');
const editLabels = ref('');
const saveError = ref<string | null>(null);
const saving = ref(false);

const updatingState = ref(false);
const updatingPriority = ref(false);
const updatingAssignee = ref(false);
const inlineError = ref<string | null>(null);

const deleting = ref(false);
const deleteError = ref<string | null>(null);

const STATES: { value: TaskState; label: string }[] = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'DONE', label: 'Done' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-800',
};

const UNASSIGNED_VALUE = '__unassigned__';

const isPrivileged = computed<boolean>(() => {
  const role = auth.user?.role;
  return role === 'manager' || role === 'admin' || role === 'super_admin';
});

const canEdit = computed<boolean>(() => {
  if (!task.value || !auth.user) return false;
  if (isPrivileged.value) return true;
  return (
    task.value.assigneeId === auth.user._id ||
    task.value.createdBy === auth.user._id
  );
});

const canDelete = computed<boolean>(() => isPrivileged.value);

const assigneeModel = computed<string>(() =>
  task.value?.assigneeId ? task.value.assigneeId : UNASSIGNED_VALUE,
);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const fetched = await taskStore.fetchTask(taskId.value);
    task.value = fetched;
    project.value = await projectStore.fetchProject(fetched.projectId);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      loadError.value = 'Task not found.';
    } else if (axios.isAxiosError(err) && err.response?.status === 403) {
      loadError.value = 'You do not have access to this task.';
    } else {
      loadError.value = 'Failed to load task.';
    }
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(taskId, load);

function startEdit(): void {
  if (!task.value) return;
  editTitle.value = task.value.title;
  editDescription.value = task.value.description;
  editLabels.value = task.value.labels.join(', ');
  saveError.value = null;
  editing.value = true;
}

function cancelEdit(): void {
  editing.value = false;
  saveError.value = null;
}

function parseLabels(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function extractMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (
      (err.response?.data as { message?: string } | undefined)?.message ??
      fallback
    );
  }
  return fallback;
}

async function save(): Promise<void> {
  if (!task.value) return;
  if (editTitle.value.trim().length < 2) {
    saveError.value = 'Title must be at least 2 characters';
    return;
  }

  saving.value = true;
  saveError.value = null;
  try {
    const updated = await taskStore.updateTask(task.value._id, {
      title: editTitle.value.trim(),
      description: editDescription.value.trim(),
      labels: parseLabels(editLabels.value),
    });
    task.value = updated;
    editing.value = false;
  } catch (err) {
    saveError.value = extractMessage(err, 'Failed to save changes.');
  } finally {
    saving.value = false;
  }
}

async function changeState(value: TaskState): Promise<void> {
  if (!task.value || task.value.state === value) return;
  updatingState.value = true;
  inlineError.value = null;
  try {
    task.value = await taskStore.updateTask(task.value._id, { state: value });
  } catch (err) {
    inlineError.value = extractMessage(err, 'Failed to update state.');
  } finally {
    updatingState.value = false;
  }
}

async function changePriority(value: TaskPriority): Promise<void> {
  if (!task.value || task.value.priority === value) return;
  updatingPriority.value = true;
  inlineError.value = null;
  try {
    task.value = await taskStore.updateTask(task.value._id, {
      priority: value,
    });
  } catch (err) {
    inlineError.value = extractMessage(err, 'Failed to update priority.');
  } finally {
    updatingPriority.value = false;
  }
}

async function changeAssignee(value: string): Promise<void> {
  if (!task.value) return;
  const next = value === UNASSIGNED_VALUE ? null : value;
  if ((task.value.assigneeId ?? null) === next) return;

  updatingAssignee.value = true;
  inlineError.value = null;
  try {
    task.value = await taskStore.updateTask(task.value._id, {
      assigneeId: next,
    });
  } catch (err) {
    inlineError.value = extractMessage(err, 'Failed to update assignee.');
  } finally {
    updatingAssignee.value = false;
  }
}

async function remove(): Promise<void> {
  if (!task.value) return;
  const confirmed = window.confirm(
    `Delete task "${task.value.title}"? This cannot be undone.`,
  );
  if (!confirmed) return;

  deleting.value = true;
  deleteError.value = null;
  try {
    const projectId = task.value.projectId;
    await taskStore.deleteTask(task.value._id);
    await router.replace({
      name: 'project-detail',
      params: { id: projectId },
    });
  } catch (err) {
    deleteError.value = extractMessage(err, 'Failed to delete task.');
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
    <div v-if="loading && !task" class="text-sm text-muted-foreground">
      Loading task…
    </div>

    <div v-else-if="loadError" class="flex flex-col gap-3">
      <p class="text-sm text-destructive">{{ loadError }}</p>
      <Button variant="outline" @click="router.replace({ name: 'dashboard' })">
        Back to dashboard
      </Button>
    </div>

    <template v-else-if="task">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <RouterLink
            v-if="project"
            :to="{ name: 'project-detail', params: { id: project._id } }"
            class="text-xs text-muted-foreground hover:underline"
          >
            ← {{ project.name }}
          </RouterLink>
          <h1 class="text-2xl font-semibold">{{ task.title }}</h1>
          <p class="text-xs text-muted-foreground">
            Created {{ formatDate(task.createdAt) }} · Updated
            {{ formatDate(task.updatedAt) }}
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
      <p v-if="inlineError" class="text-sm text-destructive">
        {{ inlineError }}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Title, description, and labels.</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <template v-if="editing">
            <div class="flex flex-col gap-2">
              <Label for="task-title">Title</Label>
              <Input id="task-title" v-model="editTitle" :disabled="saving" />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="task-description">Description</Label>
              <Textarea
                id="task-description"
                v-model="editDescription"
                rows="5"
                :disabled="saving"
              />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="task-labels">Labels</Label>
              <Input
                id="task-labels"
                v-model="editLabels"
                placeholder="Comma-separated"
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
            <p class="text-sm whitespace-pre-wrap">
              {{
                task.description
                  ? task.description
                  : 'No description provided.'
              }}
            </p>
            <div v-if="task.labels.length > 0" class="flex flex-wrap gap-2">
              <span
                v-for="label in task.labels"
                :key="label"
                class="rounded border px-2 py-0.5 text-xs text-muted-foreground"
              >
                {{ label }}
              </span>
            </div>
          </template>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>State, priority, and assignee.</CardDescription>
        </CardHeader>
        <CardContent class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div class="flex flex-col gap-2">
            <Label>State</Label>
            <Select
              :model-value="task.state"
              :disabled="!canEdit || updatingState"
              @update:model-value="(v) => changeState(v as TaskState)"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in STATES"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex flex-col gap-2">
            <Label>Priority</Label>
            <Select
              :model-value="task.priority"
              :disabled="!canEdit || updatingPriority"
              @update:model-value="(v) => changePriority(v as TaskPriority)"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in PRIORITIES"
                  :key="opt.value"
                  :value="opt.value"
                >
                  <span
                    :class="[
                      'rounded px-2 py-0.5 text-xs capitalize',
                      PRIORITY_CLASSES[opt.value],
                    ]"
                  >
                    {{ opt.label }}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex flex-col gap-2">
            <Label>Assignee</Label>
            <Select
              :model-value="assigneeModel"
              :disabled="!canEdit || updatingAssignee || !project"
              @update:model-value="(v) => changeAssignee(v as string)"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="UNASSIGNED_VALUE">Unassigned</SelectItem>
                <SelectItem
                  v-for="memberId in project?.members ?? []"
                  :key="memberId"
                  :value="memberId"
                >
                  <span class="font-mono text-xs">{{ memberId }}</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </template>
  </section>
</template>
