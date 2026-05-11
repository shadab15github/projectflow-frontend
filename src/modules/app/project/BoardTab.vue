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

interface ColumnDef {
  state: WorkItemState;
  label: string;
  accent: string;
}

const COLUMNS: ColumnDef[] = [
  { state: 'TODO', label: 'To do', accent: 'bg-slate-400' },
  { state: 'IN_PROGRESS', label: 'In progress', accent: 'bg-blue-500' },
  { state: 'IN_REVIEW', label: 'In review', accent: 'bg-purple-500' },
  { state: 'DONE', label: 'Done', accent: 'bg-emerald-500' },
  { state: 'BLOCKED', label: 'Blocked', accent: 'bg-red-500' },
  { state: 'CANCELLED', label: 'Cancelled', accent: 'bg-gray-400' },
];

const PRIORITY_BADGE: Record<WorkItemPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-800',
};

const TYPE_META: Record<
  WorkItemType,
  { icon: string; text: string }
> = {
  segment: { icon: 'Element4', text: 'text-violet-500' },
  task: { icon: 'TaskSquare', text: 'text-sky-500' },
  subtask: { icon: 'TickSquare', text: 'text-emerald-500' },
};

const TYPE_FILTERS: { value: WorkItemType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'segment', label: 'Segments' },
  { value: 'task', label: 'Tasks' },
  { value: 'subtask', label: 'Subtasks' },
];

const typeFilter = ref<WorkItemType | 'ALL'>('ALL');

const visibleItems = computed<WorkItem[]>(() => {
  if (typeFilter.value === 'ALL') return items.value;
  return items.value.filter((i) => i.type === typeFilter.value);
});

const grouped = computed<Record<WorkItemState, WorkItem[]>>(() => {
  const groups: Record<WorkItemState, WorkItem[]> = {
    TODO: [],
    IN_PROGRESS: [],
    IN_REVIEW: [],
    DONE: [],
    BLOCKED: [],
    CANCELLED: [],
  };
  for (const item of visibleItems.value) groups[item.state].push(item);
  return groups;
});

function memberInitials(id: string | null): string {
  if (!id) return '?';
  return id.slice(-2).toUpperCase();
}

function openItem(id: string): void {
  void router.push({ name: 'workitem-detail', params: { id } });
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 flex-wrap">
        <Button
          v-for="opt in TYPE_FILTERS"
          :key="opt.value"
          type="button"
          size="sm"
          :variant="typeFilter === opt.value ? 'default' : 'outline'"
          @click="typeFilter = opt.value"
        >
          {{ opt.label }}
        </Button>
        <p class="text-sm text-muted-foreground ml-2">
          {{ visibleItems.length }} item{{ visibleItems.length === 1 ? '' : 's' }}
        </p>
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

    <div v-else class="overflow-x-auto -mx-2">
      <div class="flex gap-3 px-2 pb-2 min-h-100">
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
              aria-label="Create"
              @click="openCreateTask"
            >
              <VsxIcon iconName="Add" class="size-4" />
            </button>
          </div>

          <div class="flex flex-col gap-2">
            <div
              v-for="item in grouped[col.state]"
              :key="item._id"
              class="rounded-md border bg-card p-3 cursor-pointer hover:shadow-sm hover:bg-accent/30 transition-shadow"
              @click="openItem(item._id)"
            >
              <div class="flex items-center gap-1.5 mb-1.5">
                <VsxIcon
                  :iconName="TYPE_META[item.type].icon"
                  class="size-3.5"
                  :class="TYPE_META[item.type].text"
                />
                <span class="font-mono text-[10px] text-muted-foreground">
                  {{ item.key }}
                </span>
              </div>
              <p class="text-sm font-medium line-clamp-2">{{ item.title }}</p>

              <div class="flex items-center justify-between mt-2 gap-2">
                <span
                  :class="[
                    'inline-block rounded px-2 py-0.5 text-[10px] capitalize',
                    PRIORITY_BADGE[item.priority],
                  ]"
                >
                  {{ item.priority }}
                </span>
                <Avatar v-if="item.assigneeId" class="size-6">
                  <AvatarFallback class="text-[10px]">
                    {{ memberInitials(item.assigneeId) }}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div
                v-if="item.labels.length"
                class="flex flex-wrap gap-1 mt-2"
              >
                <span
                  v-for="label in item.labels"
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
              No items
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
