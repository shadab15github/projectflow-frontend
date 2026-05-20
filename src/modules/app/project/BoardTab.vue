<script setup lang="ts">
import { computed, reactive, ref, toRefs, watch } from 'vue';
import { useRouter } from 'vue-router';
import { VsxIcon } from 'vue-iconsax';
import { VueDraggable } from 'vue-draggable-plus';
import { useWorkItemStore } from '@/store/workItem';
import { useUserLookup } from '@/store/user';
import type {
  WorkItem,
  WorkItemPriority,
  WorkItemState,
  WorkItemType,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectContext } from './projectContext';

const router = useRouter();
const workItemStore = useWorkItemStore();
const userStore = useUserLookup();
const { items } = toRefs(workItemStore);
const { project, tasksLoading, tasksError, canCreateTask, openCreateTask } =
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

const COLUMN_STATES = COLUMNS.map((c) => c.state);

const PRIORITY_BADGE: Record<WorkItemPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  urgent: 'bg-red-100 text-red-800',
};

const TYPE_META: Record<WorkItemType, { icon: string; text: string }> = {
  segment: { icon: 'Element4', text: 'text-violet-500' },
  task: { icon: 'TaskSquare', text: 'text-sky-500' },
  subtask: { icon: 'TickSquare', text: 'text-emerald-500' },
};

// --- Filter options (parity with List page; State omitted — columns ARE states) ---
const TYPE_OPTIONS: { value: WorkItemType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All types' },
  { value: 'segment', label: 'Segments' },
  { value: 'task', label: 'Tasks' },
  { value: 'subtask', label: 'Subtasks' },
];

const PRIORITY_OPTIONS: { value: WorkItemPriority | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// --- Filter & UI state ---
const typeFilter = ref<WorkItemType | 'ALL'>('ALL');
const priorityFilter = ref<WorkItemPriority | 'ALL'>('ALL');
const assigneeFilter = ref<Set<string>>(new Set());
const hideDone = ref(false);

// 'column' = each column scrolls independently (default).
// 'page'   = whole board scrolls as one (Jira-style) — column headers stick.
const scrollMode = ref<'column' | 'page'>('column');
const isPageScroll = computed(() => scrollMode.value === 'page');

const visibleItems = computed<WorkItem[]>(() => {
  let result = items.value;
  if (typeFilter.value !== 'ALL') {
    result = result.filter((i) => i.type === typeFilter.value);
  }
  if (priorityFilter.value !== 'ALL') {
    result = result.filter((i) => i.priority === priorityFilter.value);
  }
  if (assigneeFilter.value.size > 0) {
    result = result.filter((i) => {
      const id = i.assigneeId ?? 'none';
      return assigneeFilter.value.has(id);
    });
  }
  if (hideDone.value) {
    result = result.filter((i) => i.state !== 'DONE');
  }
  return result;
});

// Columns to render — DONE is dropped when hideDone is on so the empty column
// doesn't take up board space.
const visibleColumns = computed<ColumnDef[]>(() =>
  hideDone.value ? COLUMNS.filter((c) => c.state !== 'DONE') : COLUMNS,
);

// Per-column writable arrays that vue-draggable-plus mutates as the user drags.
// Re-synced from `visibleItems` whenever the shared store changes, sorted by
// boardPosition ascending (with createdAt as a tiebreaker so items without
// a position still get a stable order).
const cols = reactive<Record<WorkItemState, WorkItem[]>>({
  TODO: [],
  IN_PROGRESS: [],
  IN_REVIEW: [],
  DONE: [],
  BLOCKED: [],
  CANCELLED: [],
});

function sortItems(list: WorkItem[]): WorkItem[] {
  return [...list].sort((a, b) => {
    const ap = a.boardPosition ?? Number.MAX_SAFE_INTEGER;
    const bp = b.boardPosition ?? Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

watch(
  visibleItems,
  (next) => {
    for (const state of COLUMN_STATES) {
      cols[state] = sortItems(next.filter((i) => i.state === state));
    }
  },
  { immediate: true },
);

// Gap between sibling positions when appending or prepending so we can later
// insert between them with a midpoint computation.
const POSITION_GAP = 1000;

function computeBoardPosition(
  list: WorkItem[],
  newIndex: number,
  movedId: string,
): number {
  // Neighbours, skipping the moved item itself in case it's already in the list.
  const prev =
    [...list.slice(0, newIndex)].reverse().find((i) => i._id !== movedId) ??
    null;
  const next = list.slice(newIndex + 1).find((i) => i._id !== movedId) ?? null;

  if (prev && next) {
    return ((prev.boardPosition ?? 0) + (next.boardPosition ?? 0)) / 2;
  }
  if (prev) return (prev.boardPosition ?? 0) + POSITION_GAP;
  if (next) return (next.boardPosition ?? 0) - POSITION_GAP;
  return Date.now();
}

interface SortableEnd {
  to: HTMLElement | null;
  from: HTMLElement | null;
  oldIndex?: number;
  newIndex?: number;
}

async function onDragEnd(evt: SortableEnd): Promise<void> {
  if (!canCreateTask.value) return;
  const toEl = evt.to;
  const fromEl = evt.from;
  if (!toEl || !fromEl) return;

  const destState = toEl.dataset.colState as WorkItemState | undefined;
  const srcState = fromEl.dataset.colState as WorkItemState | undefined;
  if (!destState || !srcState) return;
  if (evt.newIndex === undefined) return;

  // No-op drop in the same column at the same position.
  if (
    destState === srcState &&
    evt.oldIndex !== undefined &&
    evt.oldIndex === evt.newIndex
  ) {
    return;
  }

  const moved = cols[destState][evt.newIndex];
  if (!moved) return;

  const newPosition = computeBoardPosition(
    cols[destState],
    evt.newIndex,
    moved._id,
  );

  // Skip the round-trip if nothing actually changed.
  if (moved.state === destState && moved.boardPosition === newPosition) {
    return;
  }

  try {
    await workItemStore.updateItem(moved._id, {
      state: destState,
      boardPosition: newPosition,
    });
  } catch {
    // Mutation failed — re-sync from the canonical store so the card snaps back.
    for (const state of COLUMN_STATES) {
      cols[state] = sortItems(
        visibleItems.value.filter((i) => i.state === state),
      );
    }
  }
}

function openItem(id: string): void {
  void router.push({ name: 'workitem-detail', params: { id } });
}

// --- Project members & assignee filter (parity with List) ---
const projectMemberUsers = computed(() => {
  if (!project.value) return [];
  return project.value.members
    .map((m) => userStore.findById(m.userId))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
});

const visibleMembers = computed(() => projectMemberUsers.value.slice(0, 5));
const extraMembers = computed(() =>
  Math.max(projectMemberUsers.value.length - visibleMembers.value.length, 0),
);

function selectAssignee(id: string): void {
  const next = new Set(assigneeFilter.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  assigneeFilter.value = next;
}

function isAssigneeSelected(id: string): boolean {
  return assigneeFilter.value.has(id);
}

function clearAssigneeFilter(): void {
  assigneeFilter.value = new Set();
}

function memberName(userId: string | null): string {
  return userStore.displayName(userId);
}

function memberInitialsForCard(id: string | null): string {
  if (!id) return '?';
  return userStore.initials(id);
}

// --- Filter chip labels & helpers ---
const typeFilterLabel = computed(
  () => TYPE_OPTIONS.find((o) => o.value === typeFilter.value)?.label ?? '',
);

const priorityFilterLabel = computed(
  () =>
    PRIORITY_OPTIONS.find((o) => o.value === priorityFilter.value)?.label ?? '',
);

const assigneeFilterLabel = computed(() => {
  if (assigneeFilter.value.size === 0) return '';
  const names = [...assigneeFilter.value].map((id) =>
    id === 'none' ? 'Unassigned' : memberName(id),
  );
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
});

const activeFilterCount = computed(() => {
  let n = 0;
  if (typeFilter.value !== 'ALL') n++;
  if (priorityFilter.value !== 'ALL') n++;
  if (assigneeFilter.value.size > 0) n++;
  return n;
});

function clearFilters(): void {
  typeFilter.value = 'ALL';
  priorityFilter.value = 'ALL';
  assigneeFilter.value = new Set();
}

// --- Export (parity with List more-menu) ---
function exportAs(format: 'csv' | 'json'): void {
  const rows = visibleItems.value;
  if (rows.length === 0) return;
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: 'application/json',
    });
    triggerDownload(blob, `board-items.json`);
    return;
  }
  const header = ['key', 'title', 'type', 'state', 'priority', 'assignee'];
  const escape = (v: string): string =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [header.join(',')];
  for (const it of rows) {
    lines.push(
      [
        it.key,
        escape(it.title),
        it.type,
        it.state,
        it.priority,
        escape(memberName(it.assigneeId)),
      ].join(','),
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  triggerDownload(blob, `board-items.csv`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const showSkeleton = computed(
  () => tasksLoading.value && items.value.length === 0,
);

// Stable per-column skeleton row counts so the placeholder doesn't shimmer
// into a different shape on every reactive tick.
const SKELETON_ROWS_BY_INDEX = [3, 2, 3, 2, 1, 2];
</script>

<template>
  <div class="flex flex-col gap-4 h-full min-h-0">
    <!-- Toolbar -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <!-- Left: assignee avatar pills (multi-select) -->
      <div
        class="flex items-center -space-x-2"
        aria-label="Filter by assignee (multi-select)"
      >
        <button
          type="button"
          class="relative size-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center transition-all hover:scale-110 hover:z-10 cursor-pointer ring-2"
          :class="
            isAssigneeSelected('none')
              ? 'ring-primary z-10'
              : 'ring-background'
          "
          title="Filter: Unassigned"
          @click="selectAssignee('none')"
        >
          <VsxIcon iconName="User" class="size-4" />
        </button>
        <button
          v-for="u in visibleMembers"
          :key="u._id"
          type="button"
          class="relative rounded-full transition-all hover:scale-110 hover:z-10 cursor-pointer ring-2"
          :class="
            isAssigneeSelected(u._id)
              ? 'ring-primary z-10'
              : 'ring-background'
          "
          :title="`Filter: ${u.name}`"
          @click="selectAssignee(u._id)"
        >
          <Avatar class="size-8">
            <AvatarFallback class="text-[10px]">
              {{ userStore.initials(u._id) }}
            </AvatarFallback>
          </Avatar>
        </button>
        <span
          v-if="extraMembers > 0"
          class="size-8 ring-2 ring-background rounded-full bg-muted text-[11px] flex items-center justify-center text-muted-foreground"
          :title="`${extraMembers} more`"
        >
          +{{ extraMembers }}
        </span>
      </div>

      <!-- Right: Filter dropdown + More menu + Create -->
      <div class="flex items-center gap-2 flex-wrap">
        <p class="text-sm text-muted-foreground mr-1">
          {{ visibleItems.length }} item{{ visibleItems.length === 1 ? '' : 's' }}
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="gap-1.5">
              <VsxIcon iconName="Filter" class="size-4" />
              <span>Filter</span>
              <span
                v-if="activeFilterCount > 0"
                class="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 text-[10px] rounded-full bg-primary text-primary-foreground"
              >
                {{ activeFilterCount }}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            class="min-w-56 max-h-96 overflow-y-auto"
          >
            <DropdownMenuLabel>Type</DropdownMenuLabel>
            <DropdownMenuItem
              v-for="opt in TYPE_OPTIONS"
              :key="`type-${opt.value}`"
              :class="typeFilter === opt.value ? 'font-medium' : ''"
              @select="typeFilter = opt.value"
            >
              <VsxIcon
                iconName="TickCircle"
                class="size-4"
                :class="
                  typeFilter === opt.value
                    ? 'opacity-100 text-primary'
                    : 'opacity-0'
                "
              />
              <span>{{ opt.label }}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Priority</DropdownMenuLabel>
            <DropdownMenuItem
              v-for="opt in PRIORITY_OPTIONS"
              :key="`prio-${opt.value}`"
              :class="priorityFilter === opt.value ? 'font-medium' : ''"
              @select="priorityFilter = opt.value"
            >
              <VsxIcon
                iconName="TickCircle"
                class="size-4"
                :class="
                  priorityFilter === opt.value
                    ? 'opacity-100 text-primary'
                    : 'opacity-0'
                "
              />
              <span>{{ opt.label }}</span>
            </DropdownMenuItem>
            <template v-if="activeFilterCount > 0">
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="clearFilters">
                <VsxIcon iconName="CloseCircle" class="size-4" />
                <span>Clear filters</span>
              </DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="gap-1.5">
              <VsxIcon iconName="More" class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="min-w-56">
            <div
              class="relative flex items-center justify-between gap-3 px-2 py-1.5 text-sm rounded-sm select-none cursor-pointer hover:bg-accent"
              @click="hideDone = !hideDone"
            >
              <span>
                {{ hideDone ? 'Show done work items' : 'Hide done work items' }}
              </span>
              <Switch
                tabindex="-1"
                :model-value="hideDone"
                class="pointer-events-none"
              />
            </div>
            <div
              class="relative flex items-center justify-between gap-3 px-2 py-1.5 text-sm rounded-sm select-none cursor-pointer hover:bg-accent"
              :title="
                isPageScroll
                  ? 'Each column scrolls on its own'
                  : 'All columns scroll together (Jira-style)'
              "
              @click="scrollMode = isPageScroll ? 'column' : 'page'"
            >
              <span>Scroll all columns together</span>
              <Switch
                tabindex="-1"
                :model-value="isPageScroll"
                class="pointer-events-none"
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Export</DropdownMenuLabel>
            <DropdownMenuItem @select="exportAs('csv')">
              <VsxIcon iconName="DocumentDownload" class="size-4" />
              <span>Export as CSV</span>
            </DropdownMenuItem>
            <DropdownMenuItem @select="exportAs('json')">
              <VsxIcon iconName="DocumentDownload" class="size-4" />
              <span>Export as JSON</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
    </div>

    <!-- Active filter chips -->
    <div
      v-if="activeFilterCount > 0"
      class="flex flex-wrap items-center gap-1.5 text-xs"
    >
      <span class="text-muted-foreground">Filters:</span>
      <span
        v-if="typeFilter !== 'ALL'"
        class="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5"
      >
        {{ typeFilterLabel }}
        <button
          type="button"
          class="hover:text-destructive cursor-pointer"
          @click="typeFilter = 'ALL'"
        >
          <VsxIcon iconName="CloseCircle" class="size-3" />
        </button>
      </span>
      <span
        v-if="priorityFilter !== 'ALL'"
        class="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5"
      >
        {{ priorityFilterLabel }}
        <button
          type="button"
          class="hover:text-destructive cursor-pointer"
          @click="priorityFilter = 'ALL'"
        >
          <VsxIcon iconName="CloseCircle" class="size-3" />
        </button>
      </span>
      <span
        v-if="assigneeFilter.size > 0"
        class="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5"
      >
        Assignee: {{ assigneeFilterLabel }}
        <button
          type="button"
          class="hover:text-destructive cursor-pointer"
          @click="clearAssigneeFilter"
        >
          <VsxIcon iconName="CloseCircle" class="size-3" />
        </button>
      </span>
    </div>

    <p v-if="tasksError" class="text-sm text-destructive">{{ tasksError }}</p>

    <!-- Skeleton: shown while first load is in flight (no cached items yet) -->
    <div
      v-if="showSkeleton"
      class="flex-1 min-h-0 overflow-x-auto -mx-2"
      aria-busy="true"
    >
      <div class="flex gap-3 px-2 pb-2 h-full">
        <div
          v-for="(col, colIdx) in COLUMNS"
          :key="`skeleton-${col.state}`"
          class="w-72 shrink-0 flex flex-col gap-2 bg-muted/40 rounded-lg p-3 max-h-full"
        >
          <div class="shrink-0 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span :class="['size-2 rounded-full', col.accent]" />
              <span class="text-sm font-medium">{{ col.label }}</span>
            </div>
            <div class="h-4 w-6 rounded bg-muted animate-pulse"></div>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
            <div
              v-for="n in SKELETON_ROWS_BY_INDEX[colIdx] ?? 2"
              :key="n"
              class="rounded-md border bg-card p-3 shrink-0"
            >
              <div class="flex items-center gap-1.5 mb-2">
                <div class="size-3.5 rounded bg-muted animate-pulse"></div>
                <div class="h-3 w-12 rounded bg-muted animate-pulse"></div>
              </div>
              <div class="h-3.5 w-full rounded bg-muted animate-pulse mb-1.5"></div>
              <div class="h-3.5 w-3/4 rounded bg-muted animate-pulse"></div>
              <div class="flex items-center justify-between mt-3">
                <div class="h-4 w-12 rounded bg-muted animate-pulse"></div>
                <div class="size-6 rounded-full bg-muted animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Real board -->
    <div
      v-else
      :class="[
        'flex-1 min-h-0 -mx-2',
        isPageScroll ? 'overflow-auto' : 'overflow-x-auto',
      ]"
    >
      <div
        :class="[
          'flex gap-3 px-2 pb-2',
          isPageScroll ? 'min-h-full' : 'h-full',
        ]"
      >
        <div
          v-for="col in visibleColumns"
          :key="col.state"
          :class="[
            'w-72 shrink-0 flex flex-col gap-2 bg-muted/40 rounded-lg p-3',
            isPageScroll ? '' : 'max-h-full',
          ]"
        >
          <div
            :class="[
              'flex items-center justify-between',
              isPageScroll
                ? 'sticky top-0 z-10 -mx-3 -mt-3 px-3 pt-3 pb-2 bg-muted rounded-t-lg'
                : 'shrink-0',
            ]"
          >
            <div class="flex items-center gap-2">
              <span :class="['size-2 rounded-full', col.accent]" />
              <span class="text-sm font-medium">{{ col.label }}</span>
              <span class="text-xs text-muted-foreground">
                {{ cols[col.state].length }}
              </span>
            </div>
            <button
              v-if="canCreateTask"
              type="button"
              class="size-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground cursor-pointer"
              aria-label="Create"
              @click="openCreateTask"
            >
              <VsxIcon iconName="Add" class="size-4" />
            </button>
          </div>

          <div
            :class="[
              'relative pr-1',
              isPageScroll
                ? 'flex-1 flex flex-col'
                : 'flex-1 min-h-0 overflow-y-auto',
            ]"
          >
            <VueDraggable
              v-model="cols[col.state]"
              :group="{ name: 'board' }"
              :disabled="!canCreateTask"
              :animation="150"
              ghost-class="board-card-ghost"
              drag-class="board-card-dragging"
              item-key="_id"
              :data-col-state="col.state"
              :class="[
                'flex flex-col gap-2',
                isPageScroll ? 'flex-1 min-h-32' : 'min-h-full',
              ]"
              @end="onDragEnd"
            >
            <div
              v-for="item in cols[col.state]"
              :key="item._id"
              class="rounded-md border bg-card p-3 cursor-pointer hover:shadow-sm hover:bg-accent/30 transition-shadow select-none"
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
                    {{ memberInitialsForCard(item.assigneeId) }}
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
            </VueDraggable>
            <p
              v-if="cols[col.state].length === 0"
              class="pointer-events-none absolute inset-x-0 top-2 text-xs text-muted-foreground text-center"
            >
              No items
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-card-ghost {
  opacity: 0.4;
}
.board-card-dragging {
  cursor: grabbing;
  transform: rotate(1.5deg);
}
</style>
