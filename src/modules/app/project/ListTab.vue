<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { VsxIcon } from 'vue-iconsax';
import { useTaskStore } from '@/store/task';
import type { Task, TaskPriority, TaskState } from '@/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useProjectContext } from './projectContext';

const router = useRouter();
const taskStore = useTaskStore();
const { tasks } = storeToRefs(taskStore);
const { tasksLoading, tasksError, canCreateTask, openCreateTask } =
  useProjectContext();

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

const STATE_BADGE: Record<TaskState, string> = {
  TODO: 'bg-green-100 text-green-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-purple-100 text-purple-800',
  DONE: 'bg-emerald-100 text-emerald-800',
  BLOCKED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-800',
};

const filter = ref<TaskState | 'ALL'>('ALL');

const visibleTasks = computed<Task[]>(() => {
  if (filter.value === 'ALL') return tasks.value;
  return tasks.value.filter((t) => t.state === filter.value);
});

function memberInitials(id: string): string {
  return id.slice(-2).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function openTask(taskId: string): void {
  void router.push({ name: 'task-detail', params: { id: taskId } });
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="opt in STATE_OPTIONS"
          :key="opt.value"
          type="button"
          size="sm"
          :variant="filter === opt.value ? 'default' : 'outline'"
          @click="filter = opt.value"
        >
          {{ opt.label }}
        </Button>
      </div>

      <Button
        v-if="canCreateTask"
        size="sm"
        class="gap-1.5"
        @click="openCreateTask"
      >
        <VsxIcon iconName="Add" class="size-4" />
        New task
      </Button>
    </div>

    <p v-if="tasksError" class="text-sm text-destructive">{{ tasksError }}</p>

    <p
      v-if="tasksLoading && tasks.length === 0"
      class="text-sm text-muted-foreground"
    >
      Loading tasks…
    </p>

    <div
      v-else-if="visibleTasks.length === 0"
      class="rounded-lg border border-dashed p-12 text-center"
    >
      <p class="text-sm text-muted-foreground">
        {{
          tasks.length === 0
            ? 'No tasks yet.'
            : 'No tasks match the selected filter.'
        }}
      </p>
    </div>

    <div v-else class="rounded-lg border bg-card overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-muted/40 text-muted-foreground">
          <tr>
            <th class="text-left font-medium px-4 py-2">Title</th>
            <th class="text-left font-medium px-4 py-2">State</th>
            <th class="text-left font-medium px-4 py-2">Priority</th>
            <th class="text-left font-medium px-4 py-2">Assignee</th>
            <th class="text-left font-medium px-4 py-2">Labels</th>
            <th class="text-left font-medium px-4 py-2 whitespace-nowrap">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="task in visibleTasks"
            :key="task._id"
            class="border-t cursor-pointer hover:bg-accent/40"
            @click="openTask(task._id)"
          >
            <td class="px-4 py-2.5 font-medium">{{ task.title }}</td>
            <td class="px-4 py-2.5">
              <span
                :class="[
                  'inline-block rounded px-2 py-0.5 text-xs',
                  STATE_BADGE[task.state],
                ]"
              >
                {{ STATE_LABELS[task.state] }}
              </span>
            </td>
            <td class="px-4 py-2.5">
              <span
                :class="[
                  'inline-block rounded px-2 py-0.5 text-xs capitalize',
                  PRIORITY_BADGE[task.priority],
                ]"
              >
                {{ task.priority }}
              </span>
            </td>
            <td class="px-4 py-2.5">
              <div v-if="task.assigneeId" class="flex items-center gap-2">
                <Avatar class="size-6">
                  <AvatarFallback class="text-[10px]">
                    {{ memberInitials(task.assigneeId) }}
                  </AvatarFallback>
                </Avatar>
                <span class="font-mono text-xs text-muted-foreground">
                  @{{ task.assigneeId.slice(-6) }}
                </span>
              </div>
              <span v-else class="text-xs text-muted-foreground">
                Unassigned
              </span>
            </td>
            <td class="px-4 py-2.5">
              <div v-if="task.labels.length" class="flex flex-wrap gap-1">
                <span
                  v-for="label in task.labels"
                  :key="label"
                  class="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {{ label }}
                </span>
              </div>
              <span v-else class="text-xs text-muted-foreground">—</span>
            </td>
            <td class="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
              {{ formatDate(task.updatedAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
