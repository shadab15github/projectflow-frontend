<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { VsxIcon } from 'vue-iconsax';
import { useWorkItemStore } from '@/store/workItem';
import type {
  WorkItem,
  WorkItemPriority,
  WorkItemState,
  WorkItemType,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useProjectContext } from './projectContext';

const router = useRouter();
const workItemStore = useWorkItemStore();
const { items } = storeToRefs(workItemStore);
const { tasksLoading, tasksError, canCreateTask, openCreateTask } =
  useProjectContext();

const STATE_OPTIONS: { value: WorkItemState | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'DONE', label: 'Done' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const TYPE_OPTIONS: { value: WorkItemType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'segment', label: 'Segments' },
  { value: 'task', label: 'Tasks' },
  { value: 'subtask', label: 'Subtasks' },
];

const STATE_LABELS: Record<WorkItemState, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
  BLOCKED: 'Blocked',
  CANCELLED: 'Cancelled',
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

const TYPE_META: Record<
  WorkItemType,
  { icon: string; text: string; label: string }
> = {
  segment: { icon: 'Element4', text: 'text-violet-500', label: 'Segment' },
  task: { icon: 'TaskSquare', text: 'text-sky-500', label: 'Task' },
  subtask: {
    icon: 'TickSquare',
    text: 'text-emerald-500',
    label: 'Subtask',
  },
};

const stateFilter = ref<WorkItemState | 'ALL'>('ALL');
const typeFilter = ref<WorkItemType | 'ALL'>('ALL');

const visibleItems = computed<WorkItem[]>(() => {
  return items.value.filter((i) => {
    if (stateFilter.value !== 'ALL' && i.state !== stateFilter.value) {
      return false;
    }
    if (typeFilter.value !== 'ALL' && i.type !== typeFilter.value) {
      return false;
    }
    return true;
  });
});

function memberInitials(id: string | null): string {
  if (!id) return '?';
  return id.slice(-2).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function openItem(id: string): void {
  void router.push({ name: 'workitem-detail', params: { id } });
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-2">
        <div class="flex flex-wrap gap-1.5">
          <Button
            v-for="opt in TYPE_OPTIONS"
            :key="opt.value"
            type="button"
            size="sm"
            :variant="typeFilter === opt.value ? 'default' : 'outline'"
            @click="typeFilter = opt.value"
          >
            {{ opt.label }}
          </Button>
        </div>
        <span class="w-px bg-border mx-1" />
        <div class="flex flex-wrap gap-1.5">
          <Button
            v-for="opt in STATE_OPTIONS"
            :key="opt.value"
            type="button"
            size="sm"
            :variant="stateFilter === opt.value ? 'default' : 'outline'"
            @click="stateFilter = opt.value"
          >
            {{ opt.label }}
          </Button>
        </div>
      </div>

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

    <p v-if="tasksError" class="text-sm text-destructive">{{ tasksError }}</p>

    <p
      v-if="tasksLoading && items.length === 0"
      class="text-sm text-muted-foreground"
    >
      Loading…
    </p>

    <div
      v-else-if="visibleItems.length === 0"
      class="rounded-lg border border-dashed p-12 text-center"
    >
      <p class="text-sm text-muted-foreground">
        {{
          items.length === 0
            ? 'No work items yet.'
            : 'No items match the selected filters.'
        }}
      </p>
    </div>

    <div v-else class="rounded-lg border bg-card overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-muted/40 text-muted-foreground">
          <tr>
            <th class="text-left font-medium px-4 py-2 w-24">Type</th>
            <th class="text-left font-medium px-4 py-2 w-28">Key</th>
            <th class="text-left font-medium px-4 py-2">Summary</th>
            <th class="text-left font-medium px-4 py-2">State</th>
            <th class="text-left font-medium px-4 py-2">Priority</th>
            <th class="text-left font-medium px-4 py-2">Assignee</th>
            <th class="text-left font-medium px-4 py-2 whitespace-nowrap">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in visibleItems"
            :key="item._id"
            class="border-t cursor-pointer hover:bg-accent/40"
            @click="openItem(item._id)"
          >
            <td class="px-4 py-2.5">
              <span class="inline-flex items-center gap-1.5">
                <VsxIcon
                  :iconName="TYPE_META[item.type].icon"
                  class="size-3.5"
                  :class="TYPE_META[item.type].text"
                />
                <span class="text-xs">{{ TYPE_META[item.type].label }}</span>
              </span>
            </td>
            <td class="px-4 py-2.5 font-mono text-xs text-muted-foreground">
              {{ item.key }}
            </td>
            <td class="px-4 py-2.5 font-medium">{{ item.title }}</td>
            <td class="px-4 py-2.5">
              <span
                :class="[
                  'inline-block rounded px-2 py-0.5 text-xs',
                  STATE_BADGE[item.state],
                ]"
              >
                {{ STATE_LABELS[item.state] }}
              </span>
            </td>
            <td class="px-4 py-2.5">
              <span
                :class="[
                  'inline-block rounded px-2 py-0.5 text-xs capitalize',
                  PRIORITY_BADGE[item.priority],
                ]"
              >
                {{ item.priority }}
              </span>
            </td>
            <td class="px-4 py-2.5">
              <div v-if="item.assigneeId" class="flex items-center gap-2">
                <Avatar class="size-6">
                  <AvatarFallback class="text-[10px]">
                    {{ memberInitials(item.assigneeId) }}
                  </AvatarFallback>
                </Avatar>
                <span class="font-mono text-xs text-muted-foreground">
                  @{{ item.assigneeId.slice(-6) }}
                </span>
              </div>
              <span v-else class="text-xs text-muted-foreground">
                Unassigned
              </span>
            </td>
            <td class="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
              {{ formatDate(item.updatedAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
