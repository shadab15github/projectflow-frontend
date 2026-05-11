<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import axios from 'axios';
import { VsxIcon } from 'vue-iconsax';
import { useWorkItemStore } from '@/store/workItem';
import { useSprintStore } from '@/store/sprint';
import { useComponentStore } from '@/store/component';
import { useAuthStore } from '@/store/auth';
import * as userService from '@/services/user.service';
import { uploadAttachment } from '@/services/upload.service';
import type {
  Project,
  ProjectComponent,
  Sprint,
  User,
  WorkItem,
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  project: Project;
  defaultType?: WorkItemType;
  defaultParentId?: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:open': [value: boolean];
  created: [item: WorkItem];
}>();

const workItemStore = useWorkItemStore();
const sprintStore = useSprintStore();
const componentStore = useComponentStore();
const auth = useAuthStore();

interface PendingAttachment {
  id: string;
  file: File;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  result?: {
    name: string;
    url: string;
    publicId: string;
    mimeType: string;
    size: number;
  };
}

const TYPES: {
  value: WorkItemType;
  label: string;
  blurb: string;
  icon: string;
  accent: string;
  ring: string;
  text: string;
}[] = [
  {
    value: 'segment',
    label: 'Segment',
    blurb: 'A large body of work made up of tasks (Epic-style).',
    icon: 'Element4',
    accent: 'bg-violet-500/15',
    ring: 'ring-violet-500/40',
    text: 'text-violet-600 dark:text-violet-400',
  },
  {
    value: 'task',
    label: 'Task',
    blurb: 'A unit of work, optionally inside a Segment.',
    icon: 'TaskSquare',
    accent: 'bg-sky-500/15',
    ring: 'ring-sky-500/40',
    text: 'text-sky-600 dark:text-sky-400',
  },
  {
    value: 'subtask',
    label: 'Subtask',
    blurb: 'A child of a Task — smaller piece of work.',
    icon: 'TickSquare',
    accent: 'bg-emerald-500/15',
    ring: 'ring-emerald-500/40',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
];

const STATES: { value: WorkItemState; label: string; dot: string }[] = [
  { value: 'TODO', label: 'To do', dot: 'bg-slate-400' },
  { value: 'IN_PROGRESS', label: 'In progress', dot: 'bg-blue-500' },
  { value: 'IN_REVIEW', label: 'In review', dot: 'bg-purple-500' },
  { value: 'DONE', label: 'Done', dot: 'bg-emerald-500' },
  { value: 'BLOCKED', label: 'Blocked', dot: 'bg-red-500' },
  { value: 'CANCELLED', label: 'Cancelled', dot: 'bg-gray-400' },
];

const PRIORITIES: {
  value: WorkItemPriority;
  label: string;
  icon: string;
  text: string;
}[] = [
  { value: 'low', label: 'Low', icon: 'ArrowDown', text: 'text-muted-foreground' },
  { value: 'medium', label: 'Medium', icon: 'Minus', text: 'text-blue-600' },
  { value: 'high', label: 'High', icon: 'ArrowUp', text: 'text-amber-600' },
  { value: 'urgent', label: 'Urgent', icon: 'ArrowUp2', text: 'text-red-600' },
];

const UNASSIGNED = '__unassigned__';
const NO_PARENT = '__none__';
const NO_SPRINT = '__none__';

interface FieldErrors {
  title?: string;
  parent?: string;
}

interface FormState {
  type: WorkItemType;
  parentId: string;
  title: string;
  description: string;
  state: WorkItemState;
  priority: WorkItemPriority;
  assigneeId: string;
  reporterId: string;
  sprintId: string;
  componentIds: string[];
  labels: string[];
  storyPoints: string;
  dueDate: string;
}

const form = reactive<FormState>({
  type: 'task',
  parentId: NO_PARENT,
  title: '',
  description: '',
  state: 'TODO',
  priority: 'medium',
  assigneeId: UNASSIGNED,
  reporterId: '',
  sprintId: NO_SPRINT,
  componentIds: [],
  labels: [],
  storyPoints: '',
  dueDate: '',
});

const fieldErrors = reactive<FieldErrors>({});
const formError = ref<string | null>(null);
const submitting = ref(false);

const tenantUsers = ref<User[]>([]);
const usersLoading = ref(false);
const usersError = ref<string | null>(null);

const sprints = ref<Sprint[]>([]);
const components = ref<ProjectComponent[]>([]);
const lookupsLoading = ref(false);

const labelInput = ref('');
const attachments = ref<PendingAttachment[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);

watch(
  () => props.open,
  (next) => {
    if (next) reset();
  },
);

watch(
  () => form.type,
  () => {
    fieldErrors.parent = undefined;
    if (form.type === 'segment') form.parentId = NO_PARENT;
    if (form.type === 'subtask' && form.parentId === NO_PARENT) {
      // pick the first task as default parent if available
      const firstTask = workItemStore.tasks[0];
      if (firstTask) form.parentId = firstTask._id;
    }
  },
);

function reset(): void {
  form.type = props.defaultType ?? 'task';
  form.parentId = props.defaultParentId ?? NO_PARENT;
  form.title = '';
  form.description = '';
  form.state = 'TODO';
  form.priority = 'medium';
  form.assigneeId = UNASSIGNED;
  form.reporterId = auth.user?._id ?? '';
  form.sprintId = NO_SPRINT;
  form.componentIds = [];
  form.labels = [];
  form.storyPoints = '';
  form.dueDate = '';
  labelInput.value = '';
  attachments.value = [];
  fieldErrors.title = undefined;
  fieldErrors.parent = undefined;
  formError.value = null;
  submitting.value = false;
  void loadLookups();
}

async function loadLookups(): Promise<void> {
  lookupsLoading.value = true;
  try {
    await Promise.all([
      loadTenantUsers(),
      sprintStore.fetchSprints(props.project._id).then(() => {
        sprints.value = sprintStore.sprints.filter(
          (s) => s.state !== 'closed',
        );
        if (sprintStore.activeSprint) {
          form.sprintId = sprintStore.activeSprint._id;
        }
      }),
      componentStore
        .fetchComponents(props.project._id)
        .then(() => {
          components.value = componentStore.components;
        }),
      // load segments/tasks if not already in store, so parent pickers work
      workItemStore.items.length === 0
        ? workItemStore.fetchItems({ projectId: props.project._id })
        : Promise.resolve(),
    ]);
  } catch {
    /* lookups are best-effort */
  } finally {
    lookupsLoading.value = false;
  }
}

async function loadTenantUsers(): Promise<void> {
  usersLoading.value = true;
  usersError.value = null;
  try {
    tenantUsers.value = await userService.listUsers();
  } catch {
    usersError.value = 'Could not load teammates.';
  } finally {
    usersLoading.value = false;
  }
}

const memberUsers = computed<User[]>(() => {
  const memberIds = new Set(props.project.members.map((m) => m.userId));
  return tenantUsers.value.filter((u) => memberIds.has(u._id));
});

const parentCandidates = computed<WorkItem[]>(() => {
  if (form.type === 'task') {
    return workItemStore.items.filter((i) => i.type === 'segment');
  }
  if (form.type === 'subtask') {
    return workItemStore.items.filter((i) => i.type === 'task');
  }
  return [];
});

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

const selectedType = computed(
  () => TYPES.find((t) => t.value === form.type) ?? TYPES[1]!,
);

const selectedParent = computed<WorkItem | null>(() => {
  if (form.parentId === NO_PARENT) return null;
  return parentCandidates.value.find((i) => i._id === form.parentId) ?? null;
});

function initialsOf(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function toggleComponent(id: string): void {
  const idx = form.componentIds.indexOf(id);
  if (idx >= 0) form.componentIds.splice(idx, 1);
  else form.componentIds.push(id);
}

function addLabel(): void {
  const v = labelInput.value.trim();
  if (!v) return;
  if (!form.labels.includes(v)) form.labels.push(v);
  labelInput.value = '';
}

function onLabelKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    addLabel();
  } else if (
    event.key === 'Backspace' &&
    !labelInput.value &&
    form.labels.length > 0
  ) {
    form.labels.pop();
  }
}

function removeLabel(label: string): void {
  form.labels = form.labels.filter((l) => l !== label);
}

function pickFiles(): void {
  fileInputRef.value?.click();
}

function onFileInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files) handleFiles(input.files);
  input.value = '';
}

function onDrop(event: DragEvent): void {
  event.preventDefault();
  dragOver.value = false;
  if (event.dataTransfer?.files) handleFiles(event.dataTransfer.files);
}

function onDragOver(event: DragEvent): void {
  event.preventDefault();
  dragOver.value = true;
}

function onDragLeave(): void {
  dragOver.value = false;
}

function handleFiles(files: FileList): void {
  for (const file of Array.from(files)) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pending: PendingAttachment = {
      id,
      file,
      status: 'uploading',
      progress: 0,
    };
    attachments.value.push(pending);
    void uploadOne(pending);
  }
}

async function uploadOne(att: PendingAttachment): Promise<void> {
  try {
    const result = await uploadAttachment(
      att.file,
      props.project._id,
      (p) => {
        att.progress = p;
      },
    );
    att.status = 'done';
    att.progress = 100;
    att.result = result;
  } catch (err) {
    att.status = 'error';
    att.error =
      err instanceof Error ? err.message : 'Upload failed. Try again.';
  }
}

function removeAttachment(id: string): void {
  attachments.value = attachments.value.filter((a) => a.id !== id);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function setOpen(value: boolean): void {
  emit('update:open', value);
}

function validate(): boolean {
  fieldErrors.title = undefined;
  fieldErrors.parent = undefined;
  let ok = true;

  if (form.title.trim().length < 2) {
    fieldErrors.title = 'Summary must be at least 2 characters';
    ok = false;
  }

  if (form.type === 'subtask' && form.parentId === NO_PARENT) {
    fieldErrors.parent = 'Subtasks require a parent task';
    ok = false;
  }

  return ok;
}

async function submit(): Promise<void> {
  formError.value = null;
  if (!validate()) return;

  // Wait for any in-flight uploads to finish.
  if (attachments.value.some((a) => a.status === 'uploading')) {
    formError.value = 'Wait for attachments to finish uploading.';
    return;
  }

  submitting.value = true;
  try {
    const created = await workItemStore.createItem({
      projectId: props.project._id,
      type: form.type,
      parentId: form.parentId === NO_PARENT ? null : form.parentId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      state: form.state,
      priority: form.priority,
      assigneeId: form.assigneeId === UNASSIGNED ? null : form.assigneeId,
      reporterId: form.reporterId || null,
      labels: form.labels,
      componentIds: form.componentIds,
      sprintId: form.sprintId === NO_SPRINT ? null : form.sprintId,
      storyPoints: form.storyPoints ? Number(form.storyPoints) : null,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      attachments: attachments.value
        .filter((a) => a.status === 'done' && a.result)
        .map((a) => a.result!),
    });
    emit('created', created);
    emit('update:open', false);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const message = (err.response?.data as { message?: string } | undefined)
        ?.message;
      formError.value = message ?? 'Failed to create work item.';
    } else {
      formError.value = 'Unexpected error. Please try again.';
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog :open="props.open" @update:open="setOpen">
    <DialogContent
      class="max-w-3xl! p-0 overflow-hidden gap-0 border-0 shadow-2xl [&>button]:hidden max-h-[92vh] flex flex-col"
    >
      <DialogTitle class="sr-only">Create work item</DialogTitle>
      <DialogDescription class="sr-only">
        Add a new {{ selectedType.label.toLowerCase() }} to
        {{ props.project.name }}.
      </DialogDescription>

      <!-- Header -->
      <div class="flex items-center justify-between px-6 pt-5 pb-4 border-b">
        <div class="flex items-center gap-2 min-w-0">
          <span
            class="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium"
          >
            <VsxIcon iconName="Element3" class="size-3.5" />
            <span class="truncate max-w-[160px]">{{ props.project.name }}</span>
          </span>
          <span class="text-muted-foreground">/</span>
          <h2 class="text-base font-semibold">Create</h2>
        </div>
        <button
          type="button"
          class="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
          aria-label="Close"
          @click="setOpen(false)"
        >
          <VsxIcon iconName="Add" class="size-4 rotate-45" />
        </button>
      </div>

      <!-- Body -->
      <div class="cwd-scroll flex-1 min-h-0 overflow-y-auto">
        <form class="px-6 py-5 flex flex-col gap-5" @submit.prevent="submit">
          <!-- Type picker -->
          <div class="flex flex-col gap-2">
            <Label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Work type
            </Label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="t in TYPES"
                :key="t.value"
                type="button"
                class="cursor-pointer rounded-lg border p-3 flex items-center gap-2.5 text-left transition-all"
                :class="
                  form.type === t.value
                    ? `border-primary bg-primary/4 ring-1 ${t.ring}`
                    : 'border-border hover:border-primary/40'
                "
                @click="form.type = t.value"
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-md"
                  :class="t.accent"
                >
                  <VsxIcon
                    :iconName="t.icon"
                    class="size-4.5"
                    :class="t.text"
                  />
                </span>
                <div class="min-w-0">
                  <p class="text-sm font-semibold">{{ t.label }}</p>
                  <p class="text-[11px] text-muted-foreground line-clamp-1">
                    {{ t.blurb }}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <!-- Parent (when applicable) -->
          <div v-if="form.type !== 'segment'" class="flex flex-col gap-1.5">
            <Label class="text-sm font-medium">
              {{ form.type === 'subtask' ? 'Parent task' : 'Parent segment' }}
              <span v-if="form.type === 'subtask'" class="text-destructive">*</span>
              <span v-else class="text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Select v-model="form.parentId" :disabled="submitting">
              <SelectTrigger class="h-10 w-full cursor-pointer">
                <SelectValue
                  :placeholder="
                    form.type === 'subtask'
                      ? 'Choose a parent task'
                      : 'No parent (standalone task)'
                  "
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-if="form.type === 'task'" :value="NO_PARENT">
                  <span class="text-muted-foreground">No parent</span>
                </SelectItem>
                <SelectItem
                  v-for="p in parentCandidates"
                  :key="p._id"
                  :value="p._id"
                >
                  <span class="inline-flex items-center gap-2">
                    <VsxIcon
                      :iconName="
                        p.type === 'segment' ? 'Element4' : 'TaskSquare'
                      "
                      class="size-3.5"
                      :class="
                        p.type === 'segment'
                          ? 'text-violet-500'
                          : 'text-sky-500'
                      "
                    />
                    <span class="font-mono text-xs text-muted-foreground">{{
                      p.key
                    }}</span>
                    <span class="truncate max-w-[280px]">{{ p.title }}</span>
                  </span>
                </SelectItem>
                <div
                  v-if="parentCandidates.length === 0"
                  class="px-2 py-3 text-xs text-muted-foreground"
                >
                  No
                  {{ form.type === 'subtask' ? 'tasks' : 'segments' }} yet.
                </div>
              </SelectContent>
            </Select>
            <p
              v-if="fieldErrors.parent"
              class="text-xs text-destructive flex items-center gap-1"
            >
              <VsxIcon iconName="InfoCircle" class="size-3.5" />
              {{ fieldErrors.parent }}
            </p>
          </div>

          <!-- Summary (title) -->
          <div class="flex flex-col gap-1.5">
            <Label for="cwi-title" class="text-sm font-medium">
              Summary <span class="text-destructive">*</span>
            </Label>
            <Input
              id="cwi-title"
              v-model="form.title"
              placeholder="A short, descriptive summary"
              class="h-11"
              :aria-invalid="!!fieldErrors.title"
              :disabled="submitting"
            />
            <p
              v-if="fieldErrors.title"
              class="text-xs text-destructive flex items-center gap-1"
            >
              <VsxIcon iconName="InfoCircle" class="size-3.5" />
              {{ fieldErrors.title }}
            </p>
          </div>

          <!-- Description -->
          <div class="flex flex-col gap-1.5">
            <Label for="cwi-desc" class="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="cwi-desc"
              v-model="form.description"
              placeholder="Add details, acceptance criteria, links…"
              rows="4"
              :disabled="submitting"
            />
          </div>

          <!-- Properties grid -->
          <div class="grid grid-cols-2 gap-x-5 gap-y-4">
            <!-- Status -->
            <div class="flex flex-col gap-1.5">
              <Label class="text-sm font-medium">Status</Label>
              <Select v-model="form.state" :disabled="submitting">
                <SelectTrigger class="h-10 w-full cursor-pointer">
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
            <div class="flex flex-col gap-1.5">
              <Label class="text-sm font-medium">Priority</Label>
              <Select v-model="form.priority" :disabled="submitting">
                <SelectTrigger class="h-10 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="p in PRIORITIES"
                    :key="p.value"
                    :value="p.value"
                  >
                    <span class="inline-flex items-center gap-2 capitalize">
                      <VsxIcon :iconName="p.icon" class="size-3.5" :class="p.text" />
                      {{ p.label }}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Assignee -->
            <div class="flex flex-col gap-1.5">
              <Label class="text-sm font-medium">Assignee</Label>
              <Select v-model="form.assigneeId" :disabled="submitting || usersLoading">
                <SelectTrigger class="h-10 w-full cursor-pointer">
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
            <div class="flex flex-col gap-1.5">
              <Label class="text-sm font-medium">Reporter</Label>
              <Select v-model="form.reporterId" :disabled="submitting || usersLoading">
                <SelectTrigger class="h-10 w-full cursor-pointer">
                  <SelectValue placeholder="Choose reporter" />
                </SelectTrigger>
                <SelectContent>
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

            <!-- Sprint -->
            <div class="flex flex-col gap-1.5">
              <Label class="text-sm font-medium">Sprint</Label>
              <Select v-model="form.sprintId" :disabled="submitting">
                <SelectTrigger class="h-10 w-full cursor-pointer">
                  <SelectValue placeholder="Backlog" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NO_SPRINT">
                    <span class="text-muted-foreground">Backlog</span>
                  </SelectItem>
                  <SelectItem
                    v-for="s in sprints"
                    :key="s._id"
                    :value="s._id"
                  >
                    <span class="inline-flex items-center gap-2">
                      <span
                        :class="[
                          'size-2 rounded-full',
                          s.state === 'active'
                            ? 'bg-emerald-500'
                            : 'bg-amber-400',
                        ]"
                      />
                      {{ s.name }}
                      <span
                        class="text-[10px] uppercase tracking-wider text-muted-foreground"
                      >
                        {{ s.state }}
                      </span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Story points -->
            <div class="flex flex-col gap-1.5">
              <Label for="cwi-sp" class="text-sm font-medium">Story points</Label>
              <Input
                id="cwi-sp"
                v-model="form.storyPoints"
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 3"
                class="h-10"
                :disabled="submitting"
              />
            </div>

            <!-- Due date -->
            <div class="flex flex-col gap-1.5 col-span-2">
              <Label for="cwi-due" class="text-sm font-medium">Due date</Label>
              <Input
                id="cwi-due"
                v-model="form.dueDate"
                type="date"
                class="h-10"
                :disabled="submitting"
              />
            </div>
          </div>

          <!-- Components -->
          <div class="flex flex-col gap-2">
            <Label class="text-sm font-medium">
              Components
              <span class="text-xs font-normal text-muted-foreground">
                ({{ components.length }} available)
              </span>
            </Label>
            <div
              v-if="components.length === 0"
              class="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-xs text-center text-muted-foreground"
            >
              No components defined for this project yet.
            </div>
            <div v-else class="flex flex-wrap gap-1.5">
              <button
                v-for="c in components"
                :key="c._id"
                type="button"
                class="cursor-pointer text-xs px-2.5 py-1 rounded-full border transition-colors"
                :class="
                  form.componentIds.includes(c._id)
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border hover:border-primary/40'
                "
                :disabled="submitting"
                @click="toggleComponent(c._id)"
              >
                <VsxIcon
                  v-if="form.componentIds.includes(c._id)"
                  iconName="TickCircle"
                  class="size-3 inline mr-1"
                />
                {{ c.name }}
              </button>
            </div>
          </div>

          <!-- Labels -->
          <div class="flex flex-col gap-2">
            <Label for="cwi-labels" class="text-sm font-medium">Labels</Label>
            <div
              class="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 min-h-10"
              :class="submitting ? 'opacity-60' : ''"
            >
              <span
                v-for="l in form.labels"
                :key="l"
                class="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-xs"
              >
                {{ l }}
                <button
                  type="button"
                  class="cursor-pointer hover:text-destructive"
                  aria-label="Remove label"
                  @click="removeLabel(l)"
                >
                  <VsxIcon iconName="Add" class="size-3 rotate-45" />
                </button>
              </span>
              <input
                id="cwi-labels"
                v-model="labelInput"
                type="text"
                class="flex-1 min-w-[120px] outline-none bg-transparent text-sm py-1"
                placeholder="Type a label and press Enter…"
                :disabled="submitting"
                @keydown="onLabelKey"
                @blur="addLabel"
              />
            </div>
          </div>

          <!-- Attachments -->
          <div class="flex flex-col gap-2">
            <Label class="text-sm font-medium">Attachments</Label>
            <div
              class="rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer"
              :class="
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted/30'
              "
              role="button"
              tabindex="0"
              @click="pickFiles"
              @keydown.enter="pickFiles"
              @drop="onDrop"
              @dragover="onDragOver"
              @dragleave="onDragLeave"
            >
              <VsxIcon
                iconName="DocumentUpload"
                class="size-6 mx-auto text-muted-foreground"
              />
              <p class="mt-2 text-sm font-medium">
                Drop files here or click to browse
              </p>
              <p class="text-xs text-muted-foreground">
                Files upload directly to Cloudinary
              </p>
              <input
                ref="fileInputRef"
                type="file"
                multiple
                class="hidden"
                @change="onFileInput"
              />
            </div>

            <ul v-if="attachments.length > 0" class="flex flex-col gap-1.5">
              <li
                v-for="att in attachments"
                :key="att.id"
                class="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
              >
                <VsxIcon
                  iconName="Paperclip"
                  class="size-4 text-muted-foreground shrink-0"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium truncate">{{ att.file.name }}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-[11px] text-muted-foreground">
                      {{ formatBytes(att.file.size) }}
                    </span>
                    <div
                      v-if="att.status === 'uploading'"
                      class="flex-1 h-1 rounded-full bg-muted overflow-hidden"
                    >
                      <div
                        class="h-full bg-primary transition-all"
                        :style="{ width: `${att.progress}%` }"
                      />
                    </div>
                    <span
                      v-if="att.status === 'uploading'"
                      class="text-[11px] text-muted-foreground"
                    >
                      {{ att.progress }}%
                    </span>
                    <span
                      v-else-if="att.status === 'done'"
                      class="text-[11px] text-emerald-600 inline-flex items-center gap-0.5"
                    >
                      <VsxIcon iconName="TickCircle" class="size-3" />
                      Uploaded
                    </span>
                    <span
                      v-else
                      class="text-[11px] text-destructive inline-flex items-center gap-0.5"
                    >
                      <VsxIcon iconName="InfoCircle" class="size-3" />
                      {{ att.error }}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  class="cursor-pointer rounded-md p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                  @click="removeAttachment(att.id)"
                >
                  <VsxIcon iconName="Trash" class="size-4" />
                </button>
              </li>
            </ul>
          </div>

          <p
            v-if="formError"
            class="text-sm text-destructive flex items-start gap-1.5"
          >
            <VsxIcon iconName="InfoCircle" class="size-4 shrink-0 mt-0.5" />
            {{ formError }}
          </p>
        </form>
      </div>

      <!-- Footer -->
      <div
        class="px-6 py-3 border-t bg-muted/20 flex items-center justify-between"
      >
        <p class="text-[11px] text-muted-foreground">
          <span class="font-mono font-semibold text-foreground">{{ props.project.key }}</span>
          – next number assigned on create
        </p>
        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            class="cursor-pointer"
            :disabled="submitting"
            @click="setOpen(false)"
          >
            Cancel
          </Button>
          <Button
            type="button"
            class="cursor-pointer"
            :disabled="submitting"
            @click="submit"
          >
            <VsxIcon
              v-if="!submitting"
              :iconName="selectedType.icon"
              class="size-4 mr-1.5"
            />
            {{ submitting ? 'Creating…' : `Create ${selectedType.label.toLowerCase()}` }}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.cwd-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
  scrollbar-gutter: stable;
}
.cwd-scroll::-webkit-scrollbar {
  width: 8px;
}
.cwd-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.cwd-scroll::-webkit-scrollbar-thumb {
  background-color: var(--border);
  border-radius: 9999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
</style>
