<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { VsxIcon } from 'vue-iconsax';
import { useTaskStore } from '@/store/task';
import type { Task, TaskState } from '@/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useProjectContext } from './projectContext';

const router = useRouter();
const taskStore = useTaskStore();
const { tasks } = storeToRefs(taskStore);
const { project, tasksLoading } = useProjectContext();

interface StateMeta {
  label: string;
  color: string;
}

const STATE_META: Record<TaskState, StateMeta> = {
  TODO: { label: 'To Do', color: '#22c55e' },
  IN_PROGRESS: { label: 'In Progress', color: '#3b82f6' },
  IN_REVIEW: { label: 'In Review', color: '#a855f7' },
  DONE: { label: 'Done', color: '#10b981' },
  BLOCKED: { label: 'Blocked', color: '#ef4444' },
  CANCELLED: { label: 'Cancelled', color: '#9ca3af' },
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function withinLast7Days(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() <= SEVEN_DAYS_MS;
}

const completedLast7 = computed<number>(
  () =>
    tasks.value.filter(
      (t) => t.state === 'DONE' && withinLast7Days(t.updatedAt),
    ).length,
);

const updatedLast7 = computed<number>(
  () => tasks.value.filter((t) => withinLast7Days(t.updatedAt)).length,
);

const createdLast7 = computed<number>(
  () => tasks.value.filter((t) => withinLast7Days(t.createdAt)).length,
);

interface DonutSegment {
  state: TaskState;
  label: string;
  color: string;
  count: number;
  length: number;
  offset: number;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const stateBreakdown = computed<DonutSegment[]>(() => {
  const counts: Record<TaskState, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
    BLOCKED: 0,
    CANCELLED: 0,
  };
  for (const task of tasks.value) counts[task.state] += 1;

  const total = tasks.value.length;
  const segments: DonutSegment[] = [];
  let cumulative = 0;

  (Object.keys(counts) as TaskState[]).forEach((state) => {
    const count = counts[state];
    if (count === 0) return;
    const length = total > 0 ? (count / total) * CIRCUMFERENCE : 0;
    segments.push({
      state,
      label: STATE_META[state].label,
      color: STATE_META[state].color,
      count,
      length,
      offset: -cumulative,
    });
    cumulative += length;
  });

  return segments;
});

const totalTasks = computed<number>(() => tasks.value.length);

const recentActivity = computed<Task[]>(() =>
  [...tasks.value]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 6),
);

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < 60 * 1000) return 'just now';
  if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / day)}d ago`;
}

function memberInitials(id: string): string {
  return id.slice(-2).toUpperCase();
}

function openTask(taskId: string): void {
  void router.push({ name: 'task-detail', params: { id: taskId } });
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Filter button (placeholder) -->
    <div>
      <Button variant="outline" size="sm" class="gap-1.5">
        <VsxIcon iconName="Filter" class="size-4" />
        Filter
      </Button>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="rounded-lg border bg-card p-4 flex items-start gap-3">
        <div class="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
          <VsxIcon iconName="TickCircle" class="size-5 text-muted-foreground" />
        </div>
        <div>
          <div class="text-xl font-semibold">
            {{ completedLast7 }}
            <span class="text-sm font-normal text-muted-foreground">completed</span>
          </div>
          <p class="text-xs text-muted-foreground">in the last 7 days</p>
        </div>
      </div>

      <div class="rounded-lg border bg-card p-4 flex items-start gap-3">
        <div class="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
          <VsxIcon iconName="Edit" class="size-5 text-muted-foreground" />
        </div>
        <div>
          <div class="text-xl font-semibold">
            {{ updatedLast7 }}
            <span class="text-sm font-normal text-muted-foreground">updated</span>
          </div>
          <p class="text-xs text-muted-foreground">in the last 7 days</p>
        </div>
      </div>

      <div class="rounded-lg border bg-card p-4 flex items-start gap-3">
        <div class="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
          <VsxIcon iconName="TaskSquare" class="size-5 text-muted-foreground" />
        </div>
        <div>
          <div class="text-xl font-semibold">
            {{ createdLast7 }}
            <span class="text-sm font-normal text-muted-foreground">created</span>
          </div>
          <p class="text-xs text-muted-foreground">in the last 7 days</p>
        </div>
      </div>

      <div class="rounded-lg border bg-card p-4 flex items-start gap-3">
        <div class="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
          <VsxIcon iconName="Calendar" class="size-5 text-muted-foreground" />
        </div>
        <div>
          <div class="text-xl font-semibold">
            0 <span class="text-sm font-normal text-muted-foreground">due soon</span>
          </div>
          <p class="text-xs text-muted-foreground">in the next 7 days</p>
        </div>
      </div>
    </div>

    <!-- Status overview + Recent activity -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Status overview -->
      <div class="rounded-lg border bg-card p-5 flex flex-col gap-4">
        <div>
          <h3 class="text-base font-semibold">Status overview</h3>
          <p class="text-sm text-muted-foreground">
            Get a snapshot of the status of your work items.
            <RouterLink
              :to="{ name: 'project-list', params: { slug: project?.slug } }"
              class="text-primary hover:underline"
            >
              View all work items
            </RouterLink>
          </p>
        </div>

        <div
          v-if="totalTasks === 0"
          class="text-sm text-muted-foreground py-8 text-center"
        >
          {{ tasksLoading ? 'Loading…' : 'No work items yet.' }}
        </div>

        <div v-else class="flex items-center gap-6 flex-wrap">
          <div class="relative size-44 shrink-0">
            <svg viewBox="0 0 100 100" class="size-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                :r="RADIUS"
                fill="none"
                class="stroke-muted"
                stroke-width="12"
              />
              <circle
                v-for="seg in stateBreakdown"
                :key="seg.state"
                cx="50"
                cy="50"
                :r="RADIUS"
                fill="none"
                :stroke="seg.color"
                stroke-width="12"
                :stroke-dasharray="`${seg.length} ${CIRCUMFERENCE - seg.length}`"
                :stroke-dashoffset="seg.offset"
                stroke-linecap="butt"
              />
            </svg>
            <div
              class="absolute inset-0 flex flex-col items-center justify-center text-center"
            >
              <div class="text-2xl font-semibold">{{ totalTasks }}</div>
              <div class="text-xs text-muted-foreground">
                Total work item{{ totalTasks === 1 ? '' : 's' }}
              </div>
            </div>
          </div>

          <ul class="flex flex-col gap-2 text-sm">
            <li
              v-for="seg in stateBreakdown"
              :key="seg.state"
              class="flex items-center gap-2"
            >
              <span
                class="size-3 rounded-sm shrink-0"
                :style="{ backgroundColor: seg.color }"
              />
              <span>{{ seg.label }}: {{ seg.count }}</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Recent activity -->
      <div class="rounded-lg border bg-card p-5 flex flex-col gap-4">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="text-base font-semibold">Recent activity</h3>
            <p class="text-sm text-muted-foreground">
              Stay up to date with what's happening across the space.
            </p>
          </div>
        </div>

        <div
          v-if="recentActivity.length === 0"
          class="text-sm text-muted-foreground py-8 text-center"
        >
          No recent activity yet.
        </div>

        <ul v-else class="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
          <li
            v-for="task in recentActivity"
            :key="task._id"
            class="flex items-start gap-3 text-sm cursor-pointer hover:bg-accent/40 rounded-md p-2 -m-2"
            @click="openTask(task._id)"
          >
            <Avatar class="size-7 shrink-0">
              <AvatarFallback class="text-[10px]">
                {{ memberInitials(task.createdBy) }}
              </AvatarFallback>
            </Avatar>
            <div class="flex-1 min-w-0">
              <p class="truncate">
                <span class="font-medium">@{{ task.createdBy.slice(-6) }}</span>
                <span class="text-muted-foreground"> updated </span>
                <span class="font-medium">{{ task.title }}</span>
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                <span
                  class="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide mr-2"
                  :style="{
                    backgroundColor: STATE_META[task.state].color + '22',
                    color: STATE_META[task.state].color,
                  }"
                >
                  {{ STATE_META[task.state].label }}
                </span>
                {{ formatRelative(task.updatedAt) }}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- Members -->
    <div class="rounded-lg border bg-card p-5 flex flex-col gap-3">
      <div>
        <h3 class="text-base font-semibold">Members</h3>
        <p class="text-sm text-muted-foreground">
          {{ project?.members.length ?? 0 }} member{{
            project?.members.length === 1 ? '' : 's'
          }}
          on this project.
        </p>
      </div>
      <div
        v-if="!project?.members.length"
        class="text-sm text-muted-foreground"
      >
        No members yet.
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <div
          v-for="memberId in project.members"
          :key="memberId"
          class="flex items-center gap-2 rounded-full border px-2 py-1"
        >
          <Avatar class="size-6">
            <AvatarFallback class="text-[10px]">
              {{ memberInitials(memberId) }}
            </AvatarFallback>
          </Avatar>
          <span class="font-mono text-xs text-muted-foreground">
            {{ memberId.slice(-6) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div class="rounded-lg border bg-card p-5 flex flex-col gap-2">
      <h3 class="text-base font-semibold">About</h3>
      <p class="text-sm">
        {{ project?.description || 'No description provided.' }}
      </p>
      <p class="text-xs text-muted-foreground">
        Status: <span class="font-medium capitalize">{{ project?.status }}</span>
      </p>
    </div>
  </div>
</template>
