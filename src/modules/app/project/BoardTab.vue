<script setup lang="ts">
import { computed } from 'vue';
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

interface ColumnDef {
  state: TaskState;
  label: string;
  accent: string;
}

const COLUMNS: ColumnDef[] = [
  { state: 'TODO', label: 'To do', accent: 'bg-green-500' },
  { state: 'IN_PROGRESS', label: 'In progress', accent: 'bg-blue-500' },
  { state: 'IN_REVIEW', label: 'In review', accent: 'bg-purple-500' },
  { state: 'DONE', label: 'Done', accent: 'bg-emerald-500' },
  { state: 'BLOCKED', label: 'Blocked', accent: 'bg-red-500' },
  { state: 'CANCELLED', label: 'Cancelled', accent: 'bg-gray-400' },
];

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-800',
};

const grouped = computed<Record<TaskState, Task[]>>(() => {
  const groups: Record<TaskState, Task[]> = {
    TODO: [],
    IN_PROGRESS: [],
    IN_REVIEW: [],
    DONE: [],
    BLOCKED: [],
    CANCELLED: [],
  };
  for (const task of tasks.value) groups[task.state].push(task);
  return groups;
});

function memberInitials(id: string): string {
  return id.slice(-2).toUpperCase();
}

function openTask(taskId: string): void {
  void router.push({ name: 'task-detail', params: { id: taskId } });
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-muted-foreground">
        {{ tasks.length }} task{{ tasks.length === 1 ? '' : 's' }} across
        {{ COLUMNS.length }} columns
      </p>

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

    <div v-else class="overflow-x-auto -mx-2">
      <div class="flex gap-3 px-2 pb-2 min-h-[400px]">
        <div
          v-for="col in COLUMNS"
          :key="col.state"
          class="w-72 shrink-0 flex flex-col gap-2 bg-muted/40 rounded-lg p-3"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span :class="['size-2 rounded-full', col.accent]" />
              <span class="text-sm font-medium">{{ col.label }}</span>
              <span class="text-xs text-muted-foreground">
                {{ grouped[col.state].length }}
              </span>
            </div>
            <button
              v-if="canCreateTask"
              type="button"
              class="size-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
              aria-label="Add task"
              @click="openCreateTask"
            >
              <VsxIcon iconName="Add" class="size-4" />
            </button>
          </div>

          <div class="flex flex-col gap-2">
            <div
              v-for="task in grouped[col.state]"
              :key="task._id"
              class="rounded-md border bg-card p-3 cursor-pointer hover:shadow-sm hover:bg-accent/30 transition-shadow"
              @click="openTask(task._id)"
            >
              <p class="text-sm font-medium line-clamp-2">{{ task.title }}</p>

              <div class="flex items-center justify-between mt-2 gap-2">
                <span
                  :class="[
                    'inline-block rounded px-2 py-0.5 text-[10px] capitalize',
                    PRIORITY_BADGE[task.priority],
                  ]"
                >
                  {{ task.priority }}
                </span>
                <Avatar v-if="task.assigneeId" class="size-6">
                  <AvatarFallback class="text-[10px]">
                    {{ memberInitials(task.assigneeId) }}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div
                v-if="task.labels.length"
                class="flex flex-wrap gap-1 mt-2"
              >
                <span
                  v-for="label in task.labels"
                  :key="label"
                  class="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {{ label }}
                </span>
              </div>
            </div>

            <p
              v-if="grouped[col.state].length === 0"
              class="text-xs text-muted-foreground text-center py-3"
            >
              No tasks
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
