<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { VsxIcon } from "vue-iconsax";
import axios from "axios";
import { useComponentStore } from "@/store/component";
import { useUserStore } from "@/store/user";
import * as workItemService from "@/services/workItem.service";
import type {
  ProjectComponent,
  WorkItem,
  WorkItemPriority,
  WorkItemState,
  WorkItemType,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectContext } from "./projectContext";

const router = useRouter();
const componentStore = useComponentStore();
const userStore = useUserStore();
const { project, tasksError, canCreateTask, openCreateTask } =
  useProjectContext();

const STATE_OPTIONS: { value: WorkItemState | "ALL"; label: string }[] = [
  { value: "ALL", label: "All states" },
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "DONE", label: "Done" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "CANCELLED", label: "Cancelled" },
];

const TYPE_OPTIONS: { value: WorkItemType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All types" },
  { value: "segment", label: "Segments" },
  { value: "task", label: "Tasks" },
  { value: "subtask", label: "Subtasks" },
];

const PRIORITY_OPTIONS: { value: WorkItemPriority | "ALL"; label: string }[] = [
  { value: "ALL", label: "All priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATE_LABELS: Record<WorkItemState, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
  BLOCKED: "Blocked",
  CANCELLED: "Cancelled",
};

const STATE_BADGE: Record<WorkItemState, string> = {
  TODO: "bg-slate-100 text-slate-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  IN_REVIEW: "bg-purple-100 text-purple-800",
  DONE: "bg-emerald-100 text-emerald-800",
  BLOCKED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-700",
};

const PRIORITY_BADGE: Record<WorkItemPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

const TYPE_META: Record<
  WorkItemType,
  { icon: string; text: string; label: string }
> = {
  segment: { icon: "Element4", text: "text-violet-500", label: "Segment" },
  task: { icon: "TaskSquare", text: "text-sky-500", label: "Task" },
  subtask: {
    icon: "TickSquare",
    text: "text-emerald-500",
    label: "Subtask",
  },
};

// --- Filters & UI state ---
const search = ref("");
const debouncedSearch = ref("");
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, (v) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    debouncedSearch.value = v.trim();
    page.value = 1;
  }, 300);
});

const stateFilter = ref<WorkItemState | "ALL">("ALL");
const typeFilter = ref<WorkItemType | "ALL">("ALL");
const priorityFilter = ref<WorkItemPriority | "ALL">("ALL");

const hideDone = ref(false);
const showHierarchy = ref(false);
const expandedIds = ref<Set<string>>(new Set());

// --- Pagination state ---
const page = ref(1);
const limit = ref(25);
const total = ref(0);
const totalPages = computed(() =>
  total.value === 0 ? 1 : Math.ceil(total.value / limit.value),
);

const items = ref<WorkItem[]>([]);
const loading = ref(false);
const loadError = ref<string | null>(null);

watch([stateFilter, typeFilter, priorityFilter, hideDone], () => {
  page.value = 1;
});

async function fetchPage(): Promise<void> {
  if (!project.value?._id) return;
  loading.value = true;
  loadError.value = null;
  try {
    const result = await workItemService.listWorkItems({
      projectId: project.value._id,
      type: typeFilter.value === "ALL" ? undefined : typeFilter.value,
      state: stateFilter.value === "ALL" ? undefined : stateFilter.value,
      search: debouncedSearch.value || undefined,
      hideDone: hideDone.value || undefined,
      page: page.value,
      limit: limit.value,
    });
    // Server doesn't filter by priority — apply client-side on the page.
    items.value =
      priorityFilter.value === "ALL"
        ? result.items
        : result.items.filter((i) => i.priority === priorityFilter.value);
    total.value = result.total;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      loadError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        "Failed to load work items.";
    } else {
      loadError.value = "Failed to load work items.";
    }
  } finally {
    loading.value = false;
  }
}

watch(
  [
    () => project.value?._id,
    page,
    limit,
    debouncedSearch,
    stateFilter,
    typeFilter,
    priorityFilter,
    hideDone,
  ],
  () => {
    void fetchPage();
  },
);

onMounted(async () => {
  await userStore.fetchUsers().catch(() => undefined);
  void fetchPage();
});

// --- Hierarchy (within the current page) ---
interface FlatRow {
  item: WorkItem;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  isLastChild: boolean;
  ancestorLines: boolean[];
}

const itemById = computed<Map<string, WorkItem>>(() => {
  const map = new Map<string, WorkItem>();
  for (const it of items.value) map.set(it._id, it);
  return map;
});

const childrenByParent = computed<Map<string | null, WorkItem[]>>(() => {
  const map = new Map<string | null, WorkItem[]>();
  for (const it of items.value) {
    const parentExists = it.parentId ? itemById.value.has(it.parentId) : false;
    const key: string | null = parentExists ? it.parentId : null;
    const bucket = map.get(key);
    if (bucket) bucket.push(it);
    else map.set(key, [it]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return map;
});

function visibleChildren(parentId: string | null): WorkItem[] {
  return childrenByParent.value.get(parentId) ?? [];
}

const flatRows = computed<FlatRow[]>(() => {
  const out: FlatRow[] = [];
  if (!showHierarchy.value) {
    for (const it of items.value) {
      out.push({
        item: it,
        depth: 0,
        hasChildren: false,
        expanded: false,
        isLastChild: true,
        ancestorLines: [],
      });
    }
    return out;
  }
  const walk = (
    parentId: string | null,
    depth: number,
    ancestorLines: boolean[],
  ): void => {
    const children = visibleChildren(parentId);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const isLastChild = i === children.length - 1;
      const hasChildren = visibleChildren(child._id).length > 0;
      const expanded = expandedIds.value.has(child._id);
      out.push({
        item: child,
        depth,
        hasChildren,
        expanded,
        isLastChild,
        ancestorLines,
      });
      if (hasChildren && expanded) {
        walk(child._id, depth + 1, [...ancestorLines, !isLastChild]);
      }
    }
  };
  walk(null, 0, []);
  return out;
});

function toggleExpand(id: string): void {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

// --- Member avatars ---
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

function memberInitials(userId: string | null): string {
  return userStore.initials(userId);
}

function memberName(userId: string | null): string {
  return userStore.displayName(userId);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function openItem(id: string): void {
  void router.push({ name: "workitem-detail", params: { id } });
}

function itemComponents(item: WorkItem): ProjectComponent[] {
  const out: ProjectComponent[] = [];
  for (const id of item.componentIds) {
    const c = componentStore.findById(id);
    if (c) out.push(c);
  }
  return out;
}

function gotoPage(p: number): void {
  if (p < 1 || p > totalPages.value) return;
  page.value = p;
}

const pageNumbers = computed<number[]>(() => {
  const tp = totalPages.value;
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1);
  const cur = page.value;
  const set = new Set<number>([1, tp, cur, cur - 1, cur + 1]);
  if (cur <= 3) {
    set.add(2);
    set.add(3);
    set.add(4);
  }
  if (cur >= tp - 2) {
    set.add(tp - 1);
    set.add(tp - 2);
    set.add(tp - 3);
  }
  return [...set].filter((n) => n >= 1 && n <= tp).sort((a, b) => a - b);
});

const showingFrom = computed(() =>
  total.value === 0 ? 0 : (page.value - 1) * limit.value + 1,
);
const showingTo = computed(() =>
  Math.min(page.value * limit.value, total.value),
);

const stateFilterLabel = computed(
  () => STATE_OPTIONS.find((o) => o.value === stateFilter.value)?.label ?? "",
);
const typeFilterLabel = computed(
  () => TYPE_OPTIONS.find((o) => o.value === typeFilter.value)?.label ?? "",
);
const priorityFilterLabel = computed(
  () =>
    PRIORITY_OPTIONS.find((o) => o.value === priorityFilter.value)?.label ?? "",
);

function clearFilters(): void {
  stateFilter.value = "ALL";
  typeFilter.value = "ALL";
  priorityFilter.value = "ALL";
}

const activeFilterCount = computed(() => {
  let n = 0;
  if (stateFilter.value !== "ALL") n++;
  if (typeFilter.value !== "ALL") n++;
  if (priorityFilter.value !== "ALL") n++;
  return n;
});

function exportAs(format: "csv" | "json"): void {
  if (items.value.length === 0) return;
  const rows = items.value;
  if (format === "json") {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, `work-items-page-${page.value}.json`);
    return;
  }
  const header = [
    "key",
    "title",
    "type",
    "state",
    "priority",
    "assignee",
    "updatedAt",
  ];
  const escape = (v: string): string =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [header.join(",")];
  for (const it of rows) {
    lines.push(
      [
        it.key,
        escape(it.title),
        it.type,
        it.state,
        it.priority,
        escape(memberName(it.assigneeId)),
        it.updatedAt,
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  triggerDownload(blob, `work-items-page-${page.value}.csv`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function notImplemented(label: string): void {
  alert(`${label}: not implemented yet.`);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- New table toolbar header -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 flex-1 min-w-64">
        <div class="relative flex-1 max-w-sm">
          <VsxIcon
            iconName="SearchNormal1"
            class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="search"
            type="search"
            placeholder="Search work items…"
            class="pl-8 h-9"
          />
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <!-- Member avatars -->
        <div
          v-if="visibleMembers.length"
          class="flex items-center -space-x-1.5"
          aria-label="Project members"
        >
          <Avatar
            v-for="u in visibleMembers"
            :key="u._id"
            class="size-7 ring-2 ring-background"
            :title="u.name"
          >
            <AvatarFallback class="text-[10px]">
              {{ userStore.initials(u._id) }}
            </AvatarFallback>
          </Avatar>
          <span
            v-if="extraMembers > 0"
            class="size-7 ring-2 ring-background rounded-full bg-muted text-[10px] flex items-center justify-center text-muted-foreground"
            :title="`${extraMembers} more`"
          >
            +{{ extraMembers }}
          </span>
        </div>

        <!-- Filter dropdown -->
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
          <DropdownMenuContent align="end" class="min-w-56">
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
            <DropdownMenuLabel>State</DropdownMenuLabel>
            <DropdownMenuItem
              v-for="opt in STATE_OPTIONS"
              :key="`state-${opt.value}`"
              :class="stateFilter === opt.value ? 'font-medium' : ''"
              @select="stateFilter = opt.value"
            >
              <VsxIcon
                iconName="TickCircle"
                class="size-4"
                :class="
                  stateFilter === opt.value
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

        <Button
          v-if="canCreateTask"
          size="sm"
          class="gap-1.5"
          @click="openCreateTask"
        >
          <VsxIcon iconName="Add" class="size-4" />
          Create Task
        </Button>

        <!-- 3-dot menu -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="icon-sm" aria-label="More actions">
              <VsxIcon iconName="More" class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="min-w-56">
            <DropdownMenuItem @select="hideDone = !hideDone">
              <VsxIcon
                iconName="TickSquare"
                class="size-4"
                :class="hideDone ? 'text-primary' : 'opacity-50'"
              />
              <span>{{
                hideDone ? "Show done work items" : "Hide done work items"
              }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem @select="showHierarchy = !showHierarchy">
              <VsxIcon
                iconName="Hierarchy"
                class="size-4"
                :class="showHierarchy ? 'text-primary' : 'opacity-50'"
              />
              <span>{{
                showHierarchy ? "Hide hierarchy" : "Show hierarchy"
              }}</span>
            </DropdownMenuItem>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="notImplemented('Import from CSV')">
              <VsxIcon iconName="DocumentUpload" class="size-4" />
              <span>Import work items from CSV</span>
            </DropdownMenuItem>
            <DropdownMenuItem @select="notImplemented('Format rules')">
              <VsxIcon iconName="Brush2" class="size-4" />
              <span>Format rules</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          class="hover:text-destructive"
          @click="typeFilter = 'ALL'"
        >
          <VsxIcon iconName="CloseCircle" class="size-3" />
        </button>
      </span>
      <span
        v-if="stateFilter !== 'ALL'"
        class="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5"
      >
        {{ stateFilterLabel }}
        <button
          type="button"
          class="hover:text-destructive"
          @click="stateFilter = 'ALL'"
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
          class="hover:text-destructive"
          @click="priorityFilter = 'ALL'"
        >
          <VsxIcon iconName="CloseCircle" class="size-3" />
        </button>
      </span>
    </div>

    <p v-if="loadError || tasksError" class="text-sm text-destructive">
      {{ loadError ?? tasksError }}
    </p>

    <p
      v-if="loading && items.length === 0"
      class="text-sm text-muted-foreground"
    >
      Loading…
    </p>

    <div
      v-else-if="flatRows.length === 0"
      class="rounded-lg border border-dashed p-12 text-center"
    >
      <p class="text-sm text-muted-foreground">
        {{
          total === 0
            ? "No work items yet."
            : "No items match the selected filters."
        }}
      </p>
    </div>

    <div v-else class="rounded-lg border bg-card overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead class="bg-muted/40 text-muted-foreground">
          <tr>
            <th
              class="text-left font-medium px-4 py-2 border-r last:border-r-0"
            >
              Summary
            </th>
            <th
              class="text-left font-medium px-4 py-2 border-r last:border-r-0"
            >
              State
            </th>
            <th
              class="text-left font-medium px-4 py-2 border-r last:border-r-0"
            >
              Priority
            </th>
            <th
              class="text-left font-medium px-4 py-2 border-r last:border-r-0"
            >
              Assignee
            </th>
            <th
              class="text-left font-medium px-4 py-2 whitespace-nowrap border-r last:border-r-0"
            >
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in flatRows"
            :key="row.item._id"
            class="border-t cursor-pointer hover:bg-accent/40 h-13"
            @click="openItem(row.item._id)"
          >
            <td class="p-0 align-middle h-13 max-w-56 border-r last:border-r-0">
              <div
                class="relative flex items-center h-13 pr-2"
                :style="{ paddingLeft: `${row.depth * 32}px` }"
              >
                <svg
                  v-if="row.depth > 0 || (row.expanded && row.hasChildren)"
                  :width="row.depth * 32 + 32"
                  :height="56"
                  class="absolute left-0 top-0 text-border pointer-events-none overflow-visible pl-5"
                >
                  <template v-if="row.depth > 0">
                    <template
                      v-for="(hasLine, i) in row.ancestorLines.slice(1)"
                      :key="`a-${i}`"
                    >
                      <line
                        v-if="hasLine"
                        :x1="i * 32 + 16"
                        :y1="0"
                        :x2="i * 32 + 16"
                        :y2="56"
                        stroke="currentColor"
                        stroke-width="1"
                      />
                    </template>
                    <path
                      :d="`M ${(row.depth - 1) * 32 + 16} 0 L ${(row.depth - 1) * 32 + 16} 8 Q ${(row.depth - 1) * 32 + 16} 24, ${row.depth * 32} 24 L ${row.depth * 32 + 4} 24`"
                      stroke="currentColor"
                      stroke-width="1"
                      fill="none"
                      stroke-linecap="round"
                    />
                    <line
                      v-if="!row.isLastChild"
                      :x1="(row.depth - 1) * 32 + 16"
                      :y1="14"
                      :x2="(row.depth - 1) * 32 + 16"
                      :y2="56"
                      stroke="currentColor"
                      stroke-width="1"
                    />
                  </template>
                  <line
                    v-if="row.expanded && row.hasChildren"
                    :x1="row.depth * 32 + 16"
                    :y1="24"
                    :x2="row.depth * 32 + 16"
                    :y2="56"
                    stroke="currentColor"
                    stroke-width="1"
                  />
                </svg>
                <button
                  v-if="row.hasChildren"
                  type="button"
                  class="relative cursor-pointer ml-6 inline-flex items-center justify-center size-6 rounded hover:bg-accent border bg-card text-muted-foreground"
                  :aria-label="row.expanded ? 'Collapse' : 'Expand'"
                  @click.stop="toggleExpand(row.item._id)"
                >
                  <VsxIcon
                    iconName="ArrowRight2"
                    class="size-3.5 transition-transform"
                    :class="row.expanded ? 'rotate-90' : ''"
                  />
                </button>
                <span v-else class="inline-block size-6"></span>
                <span
                  class="inline-flex items-center gap-2 min-w-0"
                  :class="
                    showHierarchy &&
                    ((row.hasChildren && 'ml-3') ||
                      (row.item.parentId && 'ml-2'))
                  "
                >
                  <VsxIcon
                    :iconName="TYPE_META[row.item.type].icon"
                    class="size-5 shrink-0"
                    :class="TYPE_META[row.item.type].text"
                  />
                  <span class="flex flex-col min-w-0 leading-tight">
                    <span class="truncate">{{ row.item.title }}</span>
                    <span
                      class="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground"
                    >
                      <span class="font-mono text-muted-foreground">{{
                        row.item.key
                      }}</span>
                      <template v-if="itemComponents(row.item).length">
                        <span aria-hidden="true">·</span>
                        <span
                          v-for="c in itemComponents(row.item)"
                          :key="c._id"
                          class="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px]"
                        >
                          {{ c.name }}
                        </span>
                      </template>
                    </span>
                  </span>
                </span>
              </div>
            </td>

            <td class="px-4 py-2.5 border-r last:border-r-0">
              <span
                :class="[
                  'inline-block rounded px-2 py-0.5 text-xs',
                  STATE_BADGE[row.item.state],
                ]"
              >
                {{ STATE_LABELS[row.item.state] }}
              </span>
            </td>
            <td class="px-4 py-2.5 border-r last:border-r-0">
              <span
                :class="[
                  'inline-block rounded px-2 py-0.5 text-xs capitalize',
                  PRIORITY_BADGE[row.item.priority],
                ]"
              >
                {{ row.item.priority }}
              </span>
            </td>
            <td class="px-4 py-2.5 border-r last:border-r-0">
              <div v-if="row.item.assigneeId" class="flex items-center gap-2">
                <Avatar class="size-6">
                  <AvatarFallback class="text-[10px]">
                    {{ memberInitials(row.item.assigneeId) }}
                  </AvatarFallback>
                </Avatar>
                <span class="text-xs truncate">
                  {{ memberName(row.item.assigneeId) }}
                </span>
              </div>
              <span v-else class="text-xs text-muted-foreground">
                Unassigned
              </span>
            </td>
            <td
              class="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground border-r last:border-r-0"
            >
              {{ formatDateTime(row.item.updatedAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div
      v-if="total > 0"
      class="flex flex-wrap items-center justify-between gap-3 px-1 pt-1"
    >
      <p class="text-xs text-muted-foreground">
        Showing {{ showingFrom }}–{{ showingTo }} of {{ total }}
      </p>

      <div class="flex items-center gap-3">
        <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Rows per page</span>
          <select
            v-model.number="limit"
            class="h-8 rounded border bg-background px-1.5 text-xs"
            @change="page = 1"
          >
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </label>

        <div class="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            :disabled="page === 1"
            aria-label="Previous page"
            @click="gotoPage(page - 1)"
          >
            <VsxIcon iconName="ArrowLeft2" class="size-4" />
          </Button>
          <template v-for="(p, i) in pageNumbers" :key="`p-${p}`">
            <span
              v-if="i > 0 && p - pageNumbers[i - 1] > 1"
              class="px-1 text-xs text-muted-foreground"
            >
              …
            </span>
            <Button
              :variant="p === page ? 'default' : 'outline'"
              size="icon-sm"
              class="min-w-8 px-2"
              @click="gotoPage(p)"
            >
              {{ p }}
            </Button>
          </template>
          <Button
            variant="outline"
            size="icon-sm"
            :disabled="page === totalPages"
            aria-label="Next page"
            @click="gotoPage(page + 1)"
          >
            <VsxIcon iconName="ArrowRight2" class="size-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
