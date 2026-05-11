<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { VsxIcon } from 'vue-iconsax';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/project';
import { useWorkItemStore } from '@/store/workItem';
import { useSprintStore } from '@/store/sprint';
import { useComponentStore } from '@/store/component';
import * as userService from '@/services/user.service';
import { uploadAttachment } from '@/services/upload.service';
import type {
  Project,
  ProjectComponent,
  Sprint,
  User,
  WorkItem,
  WorkItemAttachment,
  WorkItemPriority,
  WorkItemState,
  WorkItemType,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const projectStore = useProjectStore();
const workItemStore = useWorkItemStore();
const sprintStore = useSprintStore();
const componentStore = useComponentStore();

const itemId = computed<string>(() => route.params.id as string);

const item = ref<WorkItem | null>(null);
const project = ref<Project | null>(null);
const parent = ref<WorkItem | null>(null);
const children = ref<WorkItem[]>([]);
const tenantUsers = ref<User[]>([]);
const sprints = ref<Sprint[]>([]);
const components = ref<ProjectComponent[]>([]);

const loading = ref(false);
const loadError = ref<string | null>(null);
const editing = ref(false);
const saving = ref(false);
const inlineError = ref<string | null>(null);
const deleting = ref(false);
const deleteError = ref<string | null>(null);

const editTitle = ref('');
const editDescription = ref('');
const labelInput = ref('');
const editLabels = ref<string[]>([]);

const fileInputRef = ref<HTMLInputElement | null>(null);

const TYPE_META: Record<
  WorkItemType,
  { label: string; icon: string; text: string; bg: string }
> = {
  segment: {
    label: 'Segment',
    icon: 'Element4',
    text: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/15',
  },
  task: {
    label: 'Task',
    icon: 'TaskSquare',
    text: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500/15',
  },
  subtask: {
    label: 'Subtask',
    icon: 'TickSquare',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/15',
  },
};

const STATES: { value: WorkItemState; label: string; dot: string }[] = [
  { value: 'TODO', label: 'To do', dot: 'bg-slate-400' },
  { value: 'IN_PROGRESS', label: 'In progress', dot: 'bg-blue-500' },
  { value: 'IN_REVIEW', label: 'In review', dot: 'bg-purple-500' },
  { value: 'DONE', label: 'Done', dot: 'bg-emerald-500' },
  { value: 'BLOCKED', label: 'Blocked', dot: 'bg-red-500' },
  { value: 'CANCELLED', label: 'Cancelled', dot: 'bg-gray-400' },
];

const PRIORITIES: { value: WorkItemPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const PRIORITY_BADGE: Record<WorkItemPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-800',
};

const UNASSIGNED = '__unassigned__';
const NO_SPRINT = '__none__';

const isPrivileged = computed<boolean>(() => {
  const role = auth.user?.role;
  return role === 'manager' || role === 'admin' || role === 'super_admin';
});

const canEdit = computed<boolean>(() => {
  if (!item.value || !auth.user) return false;
  if (isPrivileged.value) return true;
  return (
    item.value.assigneeId === auth.user._id ||
    item.value.reporterId === auth.user._id ||
    item.value.createdBy === auth.user._id
  );
});

const canDelete = computed<boolean>(() => isPrivileged.value);

const userById = computed<Map<string, User>>(() => {
  const map = new Map<string, User>();
  for (const u of tenantUsers.value) map.set(u._id, u);
  return map;
});

const componentById = computed<Map<string, ProjectComponent>>(() => {
  const map = new Map<string, ProjectComponent>();
  for (const c of components.value) map.set(c._id, c);
  return map;
});

const sprintById = computed<Map<string, Sprint>>(() => {
  const map = new Map<string, Sprint>();
  for (const s of sprints.value) map.set(s._id, s);
  return map;
});

const memberUsers = computed<User[]>(() => {
  if (!project.value) return [];
  const memberIds = new Set(project.value.members.map((m) => m.userId));
  return tenantUsers.value.filter((u) => memberIds.has(u._id));
});

const assignableSprints = computed<Sprint[]>(() =>
  sprints.value.filter((s) => s.state !== 'closed'),
);

const assigneeModel = computed<string>(() =>
  item.value?.assigneeId ? item.value.assigneeId : UNASSIGNED,
);
const reporterModel = computed<string>(() => item.value?.reporterId ?? '');
const sprintModel = computed<string>(() =>
  item.value?.sprintId ? item.value.sprintId : NO_SPRINT,
);

const typeMeta = computed(() =>
  item.value ? TYPE_META[item.value.type] : TYPE_META.task,
);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const fetched = await workItemStore.fetchItem(itemId.value);
    item.value = fetched;
    project.value = await projectStore.fetchProject(fetched.projectId);
    await Promise.all([
      loadUsers(),
      sprintStore.fetchSprints(fetched.projectId).then(() => {
        sprints.value = sprintStore.sprints;
      }),
      componentStore.fetchComponents(fetched.projectId).then(() => {
        components.value = componentStore.components;
      }),
      loadParent(fetched),
      loadChildren(fetched),
    ]);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      loadError.value = 'Work item not found.';
    } else if (axios.isAxiosError(err) && err.response?.status === 403) {
      loadError.value = 'You do not have access to this work item.';
    } else {
      loadError.value = 'Failed to load work item.';
    }
  } finally {
    loading.value = false;
  }
}

async function loadParent(it: WorkItem): Promise<void> {
  if (!it.parentId) {
    parent.value = null;
    return;
  }
  try {
    parent.value = await workItemStore.fetchItem(it.parentId);
  } catch {
    parent.value = null;
  }
}

async function loadChildren(it: WorkItem): Promise<void> {
  try {
    if (it.type === 'segment') {
      // Fetch all items for the project, filter to children client-side via store.
      await workItemStore.fetchItems({ projectId: it.projectId });
      children.value = workItemStore.items.filter((i) => i.parentId === it._id);
    } else if (it.type === 'task') {
      await workItemStore.fetchItems({ projectId: it.projectId });
      children.value = workItemStore.items.filter(
        (i) => i.parentId === it._id && i.type === 'subtask',
      );
    } else {
      children.value = [];
    }
  } catch {
    children.value = [];
  }
}

async function loadUsers(): Promise<void> {
  try {
    tenantUsers.value = await userService.listUsers();
  } catch {
    tenantUsers.value = [];
  }
}

onMounted(load);
watch(itemId, load);

function startEdit(): void {
  if (!item.value) return;
  editTitle.value = item.value.title;
  editDescription.value = item.value.description;
  editLabels.value = [...item.value.labels];
  inlineError.value = null;
  editing.value = true;
}

function cancelEdit(): void {
  editing.value = false;
  inlineError.value = null;
}

function addLabel(): void {
  const v = labelInput.value.trim();
  if (!v) return;
  if (!editLabels.value.includes(v)) editLabels.value.push(v);
  labelInput.value = '';
}

function onLabelKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    addLabel();
  } else if (
    event.key === 'Backspace' &&
    !labelInput.value &&
    editLabels.value.length > 0
  ) {
    editLabels.value.pop();
  }
}

function removeEditLabel(label: string): void {
  editLabels.value = editLabels.value.filter((l) => l !== label);
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

async function saveDetails(): Promise<void> {
  if (!item.value) return;
  if (editTitle.value.trim().length < 2) {
    inlineError.value = 'Title must be at least 2 characters';
    return;
  }
  saving.value = true;
  inlineError.value = null;
  try {
    item.value = await workItemStore.updateItem(item.value._id, {
      title: editTitle.value.trim(),
      description: editDescription.value.trim(),
      labels: editLabels.value,
    });
    editing.value = false;
  } catch (err) {
    inlineError.value = extractMessage(err, 'Failed to save changes.');
  } finally {
    saving.value = false;
  }
}

async function patch(payload: Parameters<typeof workItemStore.updateItem>[1]): Promise<void> {
  if (!item.value) return;
  inlineError.value = null;
  try {
    item.value = await workItemStore.updateItem(item.value._id, payload);
  } catch (err) {
    inlineError.value = extractMessage(err, 'Failed to update.');
  }
}

function changeState(value: WorkItemState): Promise<void> {
  if (!item.value || item.value.state === value) return Promise.resolve();
  return patch({ state: value });
}

function changePriority(value: WorkItemPriority): Promise<void> {
  if (!item.value || item.value.priority === value) return Promise.resolve();
  return patch({ priority: value });
}

function changeAssignee(value: string): Promise<void> {
  const next = value === UNASSIGNED ? null : value;
  if ((item.value?.assigneeId ?? null) === next) return Promise.resolve();
  return patch({ assigneeId: next });
}

function changeReporter(value: string): Promise<void> {
  if (!value || item.value?.reporterId === value) return Promise.resolve();
  return patch({ reporterId: value });
}

function changeSprint(value: string): Promise<void> {
  const next = value === NO_SPRINT ? null : value;
  if ((item.value?.sprintId ?? null) === next) return Promise.resolve();
  return patch({ sprintId: next });
}

async function toggleComponent(componentId: string): Promise<void> {
  if (!item.value) return;
  const has = item.value.componentIds.includes(componentId);
  const next = has
    ? item.value.componentIds.filter((c) => c !== componentId)
    : [...item.value.componentIds, componentId];
  await patch({ componentIds: next });
}

async function changeStoryPoints(event: Event): Promise<void> {
  const v = (event.target as HTMLInputElement).value;
  await patch({ storyPoints: v ? Number(v) : null });
}

async function changeDueDate(event: Event): Promise<void> {
  const v = (event.target as HTMLInputElement).value;
  await patch({ dueDate: v ? new Date(v).toISOString() : null });
}

function pickFiles(): void {
  fileInputRef.value?.click();
}

async function onFileInput(event: Event): Promise<void> {
  if (!item.value || !project.value) return;
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  const files = Array.from(input.files);
  input.value = '';

  inlineError.value = null;
  try {
    const uploaded: WorkItemAttachment[] = [];
    for (const file of files) {
      const result = await uploadAttachment(file, project.value._id);
      uploaded.push({ ...result, uploadedAt: new Date().toISOString() });
    }
    const next = [...item.value.attachments, ...uploaded].map((a) => ({
      name: a.name,
      url: a.url,
      publicId: a.publicId,
      mimeType: a.mimeType,
      size: a.size,
    }));
    await patch({ attachments: next });
  } catch (err) {
    inlineError.value = extractMessage(err, 'Failed to upload attachment.');
  }
}

async function removeAttachment(publicId: string | undefined): Promise<void> {
  if (!item.value) return;
  const next = item.value.attachments
    .filter((a) => a.publicId !== publicId)
    .map((a) => ({
      name: a.name,
      url: a.url,
      publicId: a.publicId,
      mimeType: a.mimeType,
      size: a.size,
    }));
  await patch({ attachments: next });
}

async function remove(): Promise<void> {
  if (!item.value) return;
  const confirmed = window.confirm(
    `Delete "${item.value.title}"? This cannot be undone.`,
  );
  if (!confirmed) return;
  deleting.value = true;
  deleteError.value = null;
  try {
    const projectSlug = project.value?.slug;
    await workItemStore.deleteItem(item.value._id);
    if (projectSlug) {
      await router.replace({
        name: 'project-detail',
        params: { slug: projectSlug },
      });
    } else {
      await router.replace({ name: 'dashboard' });
    }
  } catch (err) {
    deleteError.value = extractMessage(err, 'Failed to delete.');
  } finally {
    deleting.value = false;
  }
}

function initialsOf(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function formatBytes(n: number | undefined): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function dateOnly(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

function openItem(id: string): void {
  void router.push({ name: 'workitem-detail', params: { id } });
}
</script>

<template>
  <section class="flex flex-col gap-6 p-6">
    <div v-if="loading && !item" class="text-sm text-muted-foreground">
      Loading…
    </div>

    <div v-else-if="loadError" class="flex flex-col gap-3">
      <p class="text-sm text-destructive">{{ loadError }}</p>
      <Button variant="outline" @click="router.replace({ name: 'dashboard' })">
        Back to dashboard
      </Button>
    </div>

    <template v-else-if="item">
      <!-- Breadcrumb / Header -->
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex flex-col gap-2 min-w-0">
          <nav class="flex items-center flex-wrap gap-1.5 text-xs text-muted-foreground">
            <RouterLink
              v-if="project"
              :to="{ name: 'project-detail', params: { slug: project.slug } }"
              class="hover:underline"
            >
              {{ project.name }}
            </RouterLink>
            <span>/</span>
            <RouterLink
              v-if="parent"
              :to="{ name: 'workitem-detail', params: { id: parent._id } }"
              class="hover:underline inline-flex items-center gap-1"
            >
              <VsxIcon
                :iconName="TYPE_META[parent.type].icon"
                class="size-3"
                :class="TYPE_META[parent.type].text"
              />
              <span class="font-mono">{{ parent.key }}</span>
              <span>{{ parent.title }}</span>
            </RouterLink>
            <span v-if="parent">/</span>
            <span class="font-mono text-foreground">{{ item.key }}</span>
          </nav>

          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
              :class="[typeMeta.bg, typeMeta.text]"
            >
              <VsxIcon :iconName="typeMeta.icon" class="size-3.5" />
              {{ typeMeta.label }}
            </span>
            <span class="font-mono text-xs text-muted-foreground">
              {{ item.key }}
            </span>
          </div>

          <h1 v-if="!editing" class="text-2xl font-semibold">{{ item.title }}</h1>
          <Input
            v-else
            v-model="editTitle"
            class="text-2xl font-semibold h-12"
            :disabled="saving"
          />
        </div>

        <div class="flex gap-2">
          <Button v-if="canEdit && !editing" variant="outline" @click="startEdit">
            <VsxIcon iconName="Edit" class="size-4 mr-1.5" /> Edit
          </Button>
          <Button
            v-if="canDelete"
            variant="destructive"
            :disabled="deleting"
            @click="remove"
          >
            <VsxIcon iconName="Trash" class="size-4 mr-1.5" />
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

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <!-- Main column -->
        <div class="flex flex-col gap-6">
          <!-- Description -->
          <section>
            <h3 class="text-sm font-semibold mb-2">Description</h3>
            <Textarea
              v-if="editing"
              v-model="editDescription"
              rows="6"
              :disabled="saving"
            />
            <p
              v-else-if="item.description"
              class="text-sm whitespace-pre-wrap text-foreground/90"
            >
              {{ item.description }}
            </p>
            <p v-else class="text-sm text-muted-foreground italic">
              No description provided.
            </p>
          </section>

          <!-- Edit footer (in edit mode) -->
          <div v-if="editing" class="flex flex-col gap-3">
            <div>
              <Label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Labels
              </Label>
              <div
                class="mt-1 flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 min-h-10"
              >
                <span
                  v-for="l in editLabels"
                  :key="l"
                  class="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-xs"
                >
                  {{ l }}
                  <button
                    type="button"
                    class="cursor-pointer hover:text-destructive"
                    @click="removeEditLabel(l)"
                  >
                    <VsxIcon iconName="Add" class="size-3 rotate-45" />
                  </button>
                </span>
                <input
                  v-model="labelInput"
                  type="text"
                  class="flex-1 min-w-[120px] outline-none bg-transparent text-sm py-1"
                  placeholder="Add label and press Enter…"
                  @keydown="onLabelKey"
                  @blur="addLabel"
                />
              </div>
            </div>
            <div class="flex gap-2">
              <Button :disabled="saving" @click="saveDetails">
                {{ saving ? 'Saving…' : 'Save changes' }}
              </Button>
              <Button variant="outline" :disabled="saving" @click="cancelEdit">
                Cancel
              </Button>
            </div>
          </div>

          <!-- Children (subtasks of a task / tasks of a segment) -->
          <section v-if="item.type !== 'subtask'">
            <h3 class="text-sm font-semibold mb-2">
              {{ item.type === 'segment' ? 'Tasks' : 'Subtasks' }}
              <span class="text-muted-foreground font-normal">
                ({{ children.length }})
              </span>
            </h3>
            <div
              v-if="children.length === 0"
              class="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-sm text-center text-muted-foreground"
            >
              {{
                item.type === 'segment'
                  ? 'No tasks yet in this segment.'
                  : 'No subtasks yet.'
              }}
            </div>
            <ul v-else class="rounded-md border bg-card divide-y">
              <li
                v-for="c in children"
                :key="c._id"
                class="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/40"
                @click="openItem(c._id)"
              >
                <VsxIcon
                  :iconName="TYPE_META[c.type].icon"
                  class="size-4 shrink-0"
                  :class="TYPE_META[c.type].text"
                />
                <span class="font-mono text-xs text-muted-foreground shrink-0">
                  {{ c.key }}
                </span>
                <span class="text-sm flex-1 truncate">{{ c.title }}</span>
                <span
                  :class="[
                    'inline-block rounded px-2 py-0.5 text-[10px] capitalize',
                    PRIORITY_BADGE[c.priority],
                  ]"
                >
                  {{ c.priority }}
                </span>
                <span
                  class="text-[11px] text-muted-foreground hidden sm:inline-block w-24 text-right"
                >
                  {{ STATES.find((s) => s.value === c.state)?.label }}
                </span>
              </li>
            </ul>
          </section>

          <!-- Attachments -->
          <section>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold">
                Attachments
                <span class="text-muted-foreground font-normal">
                  ({{ item.attachments.length }})
                </span>
              </h3>
              <Button
                v-if="canEdit"
                variant="outline"
                size="sm"
                class="gap-1.5"
                @click="pickFiles"
              >
                <VsxIcon iconName="Add" class="size-4" /> Upload
              </Button>
              <input
                ref="fileInputRef"
                type="file"
                multiple
                class="hidden"
                @change="onFileInput"
              />
            </div>
            <div
              v-if="item.attachments.length === 0"
              class="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-sm text-center text-muted-foreground"
            >
              No attachments.
            </div>
            <ul v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <li
                v-for="att in item.attachments"
                :key="att.publicId ?? att.url"
                class="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
              >
                <VsxIcon
                  iconName="Paperclip"
                  class="size-4 text-muted-foreground shrink-0"
                />
                <a
                  :href="att.url"
                  target="_blank"
                  rel="noreferrer"
                  class="min-w-0 flex-1 hover:underline"
                >
                  <p class="text-sm font-medium truncate">{{ att.name }}</p>
                  <p class="text-[11px] text-muted-foreground">
                    {{ formatBytes(att.size) }}
                  </p>
                </a>
                <button
                  v-if="canEdit"
                  type="button"
                  class="cursor-pointer rounded-md p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                  @click="removeAttachment(att.publicId)"
                >
                  <VsxIcon iconName="Trash" class="size-4" />
                </button>
              </li>
            </ul>
          </section>
        </div>

        <!-- Right column: properties -->
        <aside class="flex flex-col gap-4">
          <div class="rounded-lg border bg-card p-4 flex flex-col gap-3.5">
            <h3
              class="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground"
            >
              Details
            </h3>

            <!-- State -->
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Status</Label>
              <Select
                :model-value="item.state"
                :disabled="!canEdit"
                @update:model-value="(v) => changeState(v as WorkItemState)"
              >
                <SelectTrigger class="h-9 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="s in STATES"
                    :key="s.value"
                    :value="s.value"
                  >
                    <span class="inline-flex items-center gap-2">
                      <span :class="['size-2 rounded-full', s.dot]" />
                      {{ s.label }}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Priority -->
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Priority</Label>
              <Select
                :model-value="item.priority"
                :disabled="!canEdit"
                @update:model-value="(v) => changePriority(v as WorkItemPriority)"
              >
                <SelectTrigger class="h-9 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="p in PRIORITIES"
                    :key="p.value"
                    :value="p.value"
                  >
                    {{ p.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Assignee -->
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Assignee</Label>
              <Select
                :model-value="assigneeModel"
                :disabled="!canEdit"
                @update:model-value="(v) => changeAssignee(v as string)"
              >
                <SelectTrigger class="h-9 w-full cursor-pointer">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="UNASSIGNED">
                    <span class="text-muted-foreground">Unassigned</span>
                  </SelectItem>
                  <SelectItem
                    v-for="u in memberUsers"
                    :key="u._id"
                    :value="u._id"
                  >
                    <span class="inline-flex items-center gap-2">
                      <Avatar class="size-5">
                        <AvatarFallback class="text-[9px]">
                          {{ initialsOf(u.name) }}
                        </AvatarFallback>
                      </Avatar>
                      {{ u.name }}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Reporter -->
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Reporter</Label>
              <Select
                :model-value="reporterModel"
                :disabled="!canEdit"
                @update:model-value="(v) => changeReporter(v as string)"
              >
                <SelectTrigger class="h-9 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="u in memberUsers"
                    :key="u._id"
                    :value="u._id"
                  >
                    {{ u.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Sprint -->
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Sprint</Label>
              <Select
                :model-value="sprintModel"
                :disabled="!canEdit"
                @update:model-value="(v) => changeSprint(v as string)"
              >
                <SelectTrigger class="h-9 w-full cursor-pointer">
                  <SelectValue placeholder="Backlog" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NO_SPRINT">
                    <span class="text-muted-foreground">Backlog</span>
                  </SelectItem>
                  <SelectItem
                    v-for="s in assignableSprints"
                    :key="s._id"
                    :value="s._id"
                  >
                    {{ s.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Story points -->
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Story points</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                :value="item.storyPoints ?? ''"
                :disabled="!canEdit"
                class="h-9"
                placeholder="—"
                @change="changeStoryPoints"
              />
            </div>

            <!-- Due date -->
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Due date</Label>
              <Input
                type="date"
                :value="dateOnly(item.dueDate)"
                :disabled="!canEdit"
                class="h-9"
                @change="changeDueDate"
              />
            </div>

            <!-- Components -->
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Components</Label>
              <div
                v-if="components.length === 0"
                class="text-xs text-muted-foreground italic"
              >
                None defined.
              </div>
              <div v-else class="flex flex-wrap gap-1">
                <button
                  v-for="c in components"
                  :key="c._id"
                  type="button"
                  class="cursor-pointer text-xs px-2 py-0.5 rounded-full border transition-colors"
                  :class="
                    item.componentIds.includes(c._id)
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-border hover:border-primary/40'
                  "
                  :disabled="!canEdit"
                  @click="toggleComponent(c._id)"
                >
                  {{ c.name }}
                </button>
              </div>
            </div>

            <!-- Labels (read-only) -->
            <div v-if="item.labels.length > 0" class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground">Labels</Label>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="l in item.labels"
                  :key="l"
                  class="inline-block rounded bg-muted/60 px-2 py-0.5 text-xs"
                >
                  {{ l }}
                </span>
              </div>
            </div>
          </div>

          <div
            class="rounded-lg border bg-card p-4 flex flex-col gap-1 text-xs text-muted-foreground"
          >
            <div class="flex justify-between">
              <span>Created</span>
              <span class="text-foreground">{{ formatDate(item.createdAt) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Updated</span>
              <span class="text-foreground">{{ formatDate(item.updatedAt) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Reporter</span>
              <span class="text-foreground">{{
                userById.get(item.reporterId)?.name ?? '—'
              }}</span>
            </div>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>
