<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { storeToRefs } from 'pinia';
import { VsxIcon } from 'vue-iconsax';
import { useWorkItemStore } from '@/store/workItem';
import { useSprintStore } from '@/store/sprint';
import type {
  Sprint,
  WorkItem,
  WorkItemPriority,
  WorkItemState,
  WorkItemType,
} from '@/types';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectContext } from './projectContext';

const router = useRouter();
const { project, canCreateTask, openCreateTask } = useProjectContext();

const workItemStore = useWorkItemStore();
const sprintStore = useSprintStore();
const { items } = storeToRefs(workItemStore);
const { sprints } = storeToRefs(sprintStore);

const loading = ref(false);
const error = ref<string | null>(null);
const actionError = ref<string | null>(null);

// Sprint dialog state
const sprintDialogOpen = ref(false);
const editingSprintId = ref<string | null>(null);
const sprintForm = ref({
  name: '',
  goal: '',
  startDate: '',
  endDate: '',
});
const sprintSubmitting = ref(false);
const sprintError = ref<string | null>(null);

// Close-sprint dialog state
const closeDialogOpen = ref(false);
const closingSprintId = ref<string | null>(null);
const rolloverTarget = ref<string>('__backlog__');
const closingSubmitting = ref(false);
const closeError = ref<string | null>(null);
const closeResult = ref<{ rolledOver: number; completed: number } | null>(
  null,
);

// Sprint report dialog
const reportDialogOpen = ref(false);
const reportLoading = ref(false);
const reportData = ref<{
  sprint: Sprint;
  completed: { count: number; storyPoints: number };
  incomplete: { count: number; storyPoints: number };
  cancelled: { count: number; storyPoints: number };
  total: { count: number; storyPoints: number };
} | null>(null);

const TYPE_META: Record<
  WorkItemType,
  { icon: string; text: string }
> = {
  segment: { icon: 'Element4', text: 'text-violet-500' },
  task: { icon: 'TaskSquare', text: 'text-sky-500' },
  subtask: { icon: 'TickSquare', text: 'text-emerald-500' },
};

const STATE_BADGE: Record<WorkItemState, string> = {
  TODO: 'bg-slate-100 text-slate-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-purple-100 text-purple-800',
  DONE: 'bg-emerald-100 text-emerald-800',
  BLOCKED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

const PRIORITY_BADGE: Record<WorkItemPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-800',
};

const projectId = computed<string>(() => project.value?._id ?? '');

const backlogItems = computed<WorkItem[]>(() =>
  items.value.filter((i) => !i.sprintId),
);

const itemsBySprint = computed<Record<string, WorkItem[]>>(() => {
  const map: Record<string, WorkItem[]> = {};
  for (const item of items.value) {
    if (!item.sprintId) continue;
    (map[item.sprintId] ??= []).push(item);
  }
  return map;
});

const orderedSprints = computed<Sprint[]>(() =>
  [...sprints.value].sort((a, b) => {
    const order: Record<string, number> = {
      active: 0,
      planned: 1,
      closed: 2,
    };
    return order[a.state] - order[b.state];
  }),
);

const rolloverCandidates = computed<Sprint[]>(() => {
  if (!closingSprintId.value) return [];
  return sprints.value.filter(
    (s) => s.state !== 'closed' && s._id !== closingSprintId.value,
  );
});

async function load(): Promise<void> {
  if (!projectId.value) return;
  loading.value = true;
  error.value = null;
  try {
    await Promise.all([
      workItemStore.fetchItems({ projectId: projectId.value }),
      sprintStore.fetchSprints(projectId.value),
    ]);
  } catch (err) {
    error.value =
      axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ??
          'Failed to load backlog.'
        : 'Failed to load backlog.';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(projectId, load);

function extractMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (
      (err.response?.data as { message?: string } | undefined)?.message ??
      fallback
    );
  }
  return fallback;
}

function openSprintDialog(sprint?: Sprint): void {
  if (sprint) {
    editingSprintId.value = sprint._id;
    sprintForm.value = {
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.startDate ? sprint.startDate.slice(0, 10) : '',
      endDate: sprint.endDate ? sprint.endDate.slice(0, 10) : '',
    };
  } else {
    editingSprintId.value = null;
    sprintForm.value = { name: '', goal: '', startDate: '', endDate: '' };
  }
  sprintError.value = null;
  sprintDialogOpen.value = true;
}

async function submitSprint(): Promise<void> {
  if (sprintForm.value.name.trim().length < 2) {
    sprintError.value = 'Name must be at least 2 characters';
    return;
  }
  sprintSubmitting.value = true;
  sprintError.value = null;
  try {
    const payload = {
      name: sprintForm.value.name.trim(),
      goal: sprintForm.value.goal.trim() || undefined,
      startDate: sprintForm.value.startDate
        ? new Date(sprintForm.value.startDate).toISOString()
        : null,
      endDate: sprintForm.value.endDate
        ? new Date(sprintForm.value.endDate).toISOString()
        : null,
    };
    if (editingSprintId.value) {
      await sprintStore.updateSprint(editingSprintId.value, payload);
    } else {
      await sprintStore.createSprint({
        projectId: projectId.value,
        ...payload,
      });
    }
    sprintDialogOpen.value = false;
  } catch (err) {
    sprintError.value = extractMessage(err, 'Failed to save sprint.');
  } finally {
    sprintSubmitting.value = false;
  }
}

async function startSprint(id: string): Promise<void> {
  actionError.value = null;
  try {
    await sprintStore.startSprint(id);
  } catch (err) {
    actionError.value = extractMessage(err, 'Failed to start sprint.');
  }
}

function openCloseDialog(id: string): void {
  closingSprintId.value = id;
  rolloverTarget.value = '__backlog__';
  closeError.value = null;
  closeResult.value = null;
  closeDialogOpen.value = true;
}

async function confirmCloseSprint(): Promise<void> {
  if (!closingSprintId.value) return;
  closingSubmitting.value = true;
  closeError.value = null;
  try {
    const target =
      rolloverTarget.value === '__backlog__' ? null : rolloverTarget.value;
    const result = await sprintStore.closeSprint(
      closingSprintId.value,
      target,
    );
    closeResult.value = {
      rolledOver: result.rolledOver,
      completed: result.completed,
    };
    // Refresh items to reflect rollover.
    await workItemStore.fetchItems({ projectId: projectId.value });
  } catch (err) {
    closeError.value = extractMessage(err, 'Failed to close sprint.');
  } finally {
    closingSubmitting.value = false;
  }
}

async function deleteSprint(id: string): Promise<void> {
  const sprint = sprintStore.findById(id);
  if (!sprint) return;
  const confirmed = window.confirm(
    `Delete sprint "${sprint.name}"? Items in it will move to the backlog.`,
  );
  if (!confirmed) return;
  actionError.value = null;
  try {
    await sprintStore.deleteSprint(id);
    await workItemStore.fetchItems({ projectId: projectId.value });
  } catch (err) {
    actionError.value = extractMessage(err, 'Failed to delete sprint.');
  }
}

async function viewReport(id: string): Promise<void> {
  reportDialogOpen.value = true;
  reportLoading.value = true;
  reportData.value = null;
  try {
    reportData.value = await sprintStore.fetchReport(id);
  } catch (err) {
    actionError.value = extractMessage(err, 'Failed to load sprint report.');
    reportDialogOpen.value = false;
  } finally {
    reportLoading.value = false;
  }
}

function openItem(id: string): void {
  void router.push({ name: 'workitem-detail', params: { id } });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

function memberInitials(id: string | null): string {
  if (!id) return '?';
  return id.slice(-2).toUpperCase();
}

function sprintStateColor(state: Sprint['state']): string {
  if (state === 'active') return 'bg-emerald-500';
  if (state === 'planned') return 'bg-amber-400';
  return 'bg-slate-400';
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h2 class="text-lg font-semibold">Backlog & Sprints</h2>
        <p class="text-sm text-muted-foreground">
          Plan sprints and triage backlog work for {{ project?.name }}.
        </p>
      </div>
      <div class="flex gap-2">
        <Button
          v-if="canCreateTask"
          variant="outline"
          size="sm"
          class="gap-1.5"
          @click="openSprintDialog()"
        >
          <VsxIcon iconName="Calendar" class="size-4" /> New sprint
        </Button>
        <Button
          v-if="canCreateTask"
          size="sm"
          class="gap-1.5"
          @click="openCreateTask"
        >
          <VsxIcon iconName="Add" class="size-4" /> Create item
        </Button>
      </div>
    </div>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    <p v-if="actionError" class="text-sm text-destructive">{{ actionError }}</p>

    <p v-if="loading" class="text-sm text-muted-foreground">Loading…</p>

    <template v-else>
      <!-- Sprint sections -->
      <section
        v-for="sprint in orderedSprints"
        :key="sprint._id"
        class="rounded-lg border bg-card overflow-hidden"
      >
        <div
          class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30"
        >
          <div class="flex items-center gap-3 min-w-0">
            <span :class="['size-2 rounded-full', sprintStateColor(sprint.state)]" />
            <h3 class="font-semibold truncate">{{ sprint.name }}</h3>
            <span
              class="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded bg-muted/60 text-muted-foreground"
            >
              {{ sprint.state }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ (itemsBySprint[sprint._id] ?? []).length }} items
            </span>
            <span
              v-if="sprint.startDate || sprint.endDate"
              class="text-xs text-muted-foreground"
            >
              · {{ formatDate(sprint.startDate) }} → {{ formatDate(sprint.endDate) }}
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <Button
              v-if="canCreateTask && sprint.state === 'planned'"
              size="sm"
              variant="default"
              class="gap-1"
              @click="startSprint(sprint._id)"
            >
              <VsxIcon iconName="Play" class="size-3.5" /> Start sprint
            </Button>
            <Button
              v-if="canCreateTask && sprint.state === 'active'"
              size="sm"
              variant="default"
              class="gap-1"
              @click="openCloseDialog(sprint._id)"
            >
              <VsxIcon iconName="TickCircle" class="size-3.5" /> Complete sprint
            </Button>
            <Button
              v-if="sprint.state === 'closed'"
              size="sm"
              variant="outline"
              class="gap-1"
              @click="viewReport(sprint._id)"
            >
              <VsxIcon iconName="Chart" class="size-3.5" /> Report
            </Button>
            <Button
              v-if="canCreateTask && sprint.state !== 'closed'"
              size="sm"
              variant="ghost"
              aria-label="Edit sprint"
              @click="openSprintDialog(sprint)"
            >
              <VsxIcon iconName="Edit" class="size-3.5" />
            </Button>
            <Button
              v-if="canCreateTask && sprint.state !== 'active'"
              size="sm"
              variant="ghost"
              aria-label="Delete sprint"
              @click="deleteSprint(sprint._id)"
            >
              <VsxIcon iconName="Trash" class="size-3.5" />
            </Button>
          </div>
        </div>

        <p
          v-if="sprint.goal"
          class="px-4 pt-2 text-sm text-muted-foreground italic"
        >
          🎯 {{ sprint.goal }}
        </p>

        <ul
          v-if="(itemsBySprint[sprint._id] ?? []).length > 0"
          class="divide-y"
        >
          <li
            v-for="item in itemsBySprint[sprint._id]"
            :key="item._id"
            class="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/40"
            @click="openItem(item._id)"
          >
            <VsxIcon
              :iconName="TYPE_META[item.type].icon"
              class="size-4 shrink-0"
              :class="TYPE_META[item.type].text"
            />
            <span class="font-mono text-xs text-muted-foreground shrink-0 w-20">
              {{ item.key }}
            </span>
            <span class="text-sm flex-1 truncate">{{ item.title }}</span>
            <span
              :class="[
                'inline-block rounded px-2 py-0.5 text-[10px] capitalize hidden md:inline-block',
                PRIORITY_BADGE[item.priority],
              ]"
            >
              {{ item.priority }}
            </span>
            <span
              :class="[
                'inline-block rounded px-2 py-0.5 text-[10px] hidden md:inline-block',
                STATE_BADGE[item.state],
              ]"
            >
              {{ item.state.replace('_', ' ').toLowerCase() }}
            </span>
            <span
              v-if="item.storyPoints !== null"
              class="size-6 flex items-center justify-center rounded-full bg-muted text-[10px] font-semibold"
            >
              {{ item.storyPoints }}
            </span>
          </li>
        </ul>
        <div v-else class="px-4 py-6 text-center text-sm text-muted-foreground">
          No items in this sprint yet.
        </div>
      </section>

      <!-- Backlog -->
      <section class="rounded-lg border bg-card overflow-hidden">
        <div
          class="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30"
        >
          <div class="flex items-center gap-2">
            <VsxIcon iconName="DocumentText" class="size-4 text-muted-foreground" />
            <h3 class="font-semibold">Backlog</h3>
            <span class="text-xs text-muted-foreground">
              {{ backlogItems.length }} items
            </span>
          </div>
        </div>

        <ul v-if="backlogItems.length > 0" class="divide-y">
          <li
            v-for="item in backlogItems"
            :key="item._id"
            class="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/40"
            @click="openItem(item._id)"
          >
            <VsxIcon
              :iconName="TYPE_META[item.type].icon"
              class="size-4 shrink-0"
              :class="TYPE_META[item.type].text"
            />
            <span class="font-mono text-xs text-muted-foreground shrink-0 w-20">
              {{ item.key }}
            </span>
            <span class="text-sm flex-1 truncate">{{ item.title }}</span>
            <span
              :class="[
                'inline-block rounded px-2 py-0.5 text-[10px] capitalize hidden md:inline-block',
                PRIORITY_BADGE[item.priority],
              ]"
            >
              {{ item.priority }}
            </span>
            <span
              :class="[
                'inline-block rounded px-2 py-0.5 text-[10px] hidden md:inline-block',
                STATE_BADGE[item.state],
              ]"
            >
              {{ item.state.replace('_', ' ').toLowerCase() }}
            </span>
          </li>
        </ul>
        <div v-else class="px-4 py-8 text-center text-sm text-muted-foreground">
          The backlog is empty.
        </div>
      </section>
    </template>

    <!-- Sprint editor dialog -->
    <Dialog v-model:open="sprintDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {{ editingSprintId ? 'Edit sprint' : 'New sprint' }}
          </DialogTitle>
          <DialogDescription>
            Sprints are time-boxed iterations of work for this project.
          </DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitSprint">
          <div class="flex flex-col gap-1.5">
            <Label for="sprint-name">Name</Label>
            <Input
              id="sprint-name"
              v-model="sprintForm.name"
              placeholder="Sprint 12"
              :disabled="sprintSubmitting"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="sprint-goal">Goal (optional)</Label>
            <Textarea
              id="sprint-goal"
              v-model="sprintForm.goal"
              rows="3"
              placeholder="What outcome should this sprint deliver?"
              :disabled="sprintSubmitting"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label for="sprint-start">Start date</Label>
              <Input
                id="sprint-start"
                v-model="sprintForm.startDate"
                type="date"
                :disabled="sprintSubmitting"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="sprint-end">End date</Label>
              <Input
                id="sprint-end"
                v-model="sprintForm.endDate"
                type="date"
                :disabled="sprintSubmitting"
              />
            </div>
          </div>
          <p v-if="sprintError" class="text-sm text-destructive">
            {{ sprintError }}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="sprintSubmitting"
              @click="sprintDialogOpen = false"
            >
              Cancel
            </Button>
            <Button type="submit" :disabled="sprintSubmitting">
              {{ sprintSubmitting ? 'Saving…' : 'Save' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Close-sprint dialog -->
    <Dialog v-model:open="closeDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete sprint</DialogTitle>
          <DialogDescription>
            Choose where to move incomplete items. Done items stay attached to
            this sprint for reporting.
          </DialogDescription>
        </DialogHeader>

        <div v-if="!closeResult" class="flex flex-col gap-3">
          <Label>Move incomplete items to</Label>
          <Select v-model="rolloverTarget" :disabled="closingSubmitting">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__backlog__">Backlog</SelectItem>
              <SelectItem
                v-for="s in rolloverCandidates"
                :key="s._id"
                :value="s._id"
              >
                {{ s.name }}
                <span class="text-[10px] uppercase ml-1 text-muted-foreground">
                  {{ s.state }}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="closeError" class="text-sm text-destructive">
            {{ closeError }}
          </p>
        </div>

        <div v-else class="flex flex-col gap-2 text-sm">
          <p class="font-medium">Sprint completed.</p>
          <p>{{ closeResult.completed }} item(s) marked done.</p>
          <p>{{ closeResult.rolledOver }} item(s) rolled over.</p>
        </div>

        <DialogFooter>
          <Button
            v-if="!closeResult"
            type="button"
            variant="outline"
            :disabled="closingSubmitting"
            @click="closeDialogOpen = false"
          >
            Cancel
          </Button>
          <Button
            v-if="!closeResult"
            :disabled="closingSubmitting"
            @click="confirmCloseSprint"
          >
            {{ closingSubmitting ? 'Completing…' : 'Complete sprint' }}
          </Button>
          <Button v-else @click="closeDialogOpen = false">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Sprint report dialog -->
    <Dialog v-model:open="reportDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sprint report</DialogTitle>
          <DialogDescription v-if="reportData">
            {{ reportData.sprint.name }} ·
            {{ formatDate(reportData.sprint.startedAt) }} →
            {{ formatDate(reportData.sprint.closedAt) }}
          </DialogDescription>
        </DialogHeader>

        <div
          v-if="reportLoading"
          class="text-sm text-muted-foreground py-4 text-center"
        >
          Loading report…
        </div>

        <div v-else-if="reportData" class="grid grid-cols-3 gap-3">
          <div class="rounded-lg border bg-emerald-500/5 p-3">
            <p class="text-[11px] uppercase tracking-wider text-emerald-700">
              Completed
            </p>
            <p class="text-2xl font-semibold mt-1">
              {{ reportData.completed.count }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ reportData.completed.storyPoints }} pts
            </p>
          </div>
          <div class="rounded-lg border bg-amber-500/5 p-3">
            <p class="text-[11px] uppercase tracking-wider text-amber-700">
              Incomplete
            </p>
            <p class="text-2xl font-semibold mt-1">
              {{ reportData.incomplete.count }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ reportData.incomplete.storyPoints }} pts
            </p>
          </div>
          <div class="rounded-lg border bg-slate-500/5 p-3">
            <p class="text-[11px] uppercase tracking-wider text-slate-700">
              Cancelled
            </p>
            <p class="text-2xl font-semibold mt-1">
              {{ reportData.cancelled.count }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ reportData.cancelled.storyPoints }} pts
            </p>
          </div>
          <div class="col-span-3 text-sm text-muted-foreground text-center pt-2">
            Total: {{ reportData.total.count }} items ·
            {{ reportData.total.storyPoints }} story points
          </div>
        </div>

        <DialogFooter>
          <Button @click="reportDialogOpen = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
