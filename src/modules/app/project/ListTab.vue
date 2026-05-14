<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { VsxIcon } from "vue-iconsax";
import axios from "axios";
import { useComponentStore } from "@/store/component";
import { useSprintStore } from "@/store/sprint";
import { useUserStore } from "@/store/user";
import * as workItemService from "@/services/workItem.service";
import type {
  ProjectComponent,
  WorkItem,
  WorkItemPriority,
  WorkItemSortBy,
  WorkItemState,
  WorkItemType,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
const sprintStore = useSprintStore();
const userStore = useUserStore();
const { project, tasksError, canCreateTask, openCreateTask, reloadTasks } =
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

// --- Column definitions ---
type ColumnKey =
  | "select"
  | "summary"
  | "type"
  | "key"
  | "state"
  | "priority"
  | "assignee"
  | "reporter"
  | "labels"
  | "components"
  | "sprint"
  | "storyPoints"
  | "dueDate"
  | "attachments"
  | "updated"
  | "created"
  | "createdBy"
  | "actions";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  sortBy?: WorkItemSortBy;
  defaultWidth: number;
  minWidth: number;
}

// Columns whose width is locked and cannot be resized by the user or any code
// path — they're rendered from defaultWidth directly, not from columnWidths.
const FIXED_WIDTH_COLUMNS = new Set<ColumnKey>(["select", "actions"]);

const COLUMNS: ColumnDef[] = [
  { key: "select", label: "", defaultWidth: 52, minWidth: 52 },
  {
    key: "summary",
    label: "Summary",
    sortBy: "title",
    defaultWidth: 360,
    minWidth: 200,
  },
  { key: "type", label: "Type", defaultWidth: 120, minWidth: 90 },
  {
    key: "key",
    label: "Key",
    sortBy: "key",
    defaultWidth: 110,
    minWidth: 80,
  },
  {
    key: "state",
    label: "State",
    sortBy: "state",
    defaultWidth: 140,
    minWidth: 100,
  },
  {
    key: "priority",
    label: "Priority",
    sortBy: "priority",
    defaultWidth: 120,
    minWidth: 90,
  },
  { key: "assignee", label: "Assignee", defaultWidth: 200, minWidth: 140 },
  { key: "reporter", label: "Reporter", defaultWidth: 200, minWidth: 140 },
  { key: "labels", label: "Labels", defaultWidth: 200, minWidth: 140 },
  { key: "components", label: "Components", defaultWidth: 200, minWidth: 140 },
  { key: "sprint", label: "Sprint", defaultWidth: 160, minWidth: 120 },
  {
    key: "storyPoints",
    label: "Story points",
    defaultWidth: 110,
    minWidth: 80,
  },
  { key: "dueDate", label: "Due date", defaultWidth: 140, minWidth: 110 },
  {
    key: "attachments",
    label: "Attachments",
    defaultWidth: 130,
    minWidth: 100,
  },
  {
    key: "updated",
    label: "Updated",
    sortBy: "updatedAt",
    defaultWidth: 180,
    minWidth: 140,
  },
  {
    key: "created",
    label: "Created",
    sortBy: "createdAt",
    defaultWidth: 180,
    minWidth: 140,
  },
  { key: "createdBy", label: "Created by", defaultWidth: 200, minWidth: 140 },
  { key: "actions", label: "", defaultWidth: 64, minWidth: 64 },
];

const visibleColumns = ref<Record<ColumnKey, boolean>>({
  select: true,
  summary: true,
  type: false,
  key: false,
  state: true,
  priority: true,
  assignee: true,
  reporter: false,
  labels: false,
  components: false,
  sprint: false,
  storyPoints: false,
  dueDate: false,
  attachments: false,
  updated: true,
  created: false,
  createdBy: false,
  actions: true,
});

const columnWidths = ref<Record<ColumnKey, number>>(
  Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth])) as Record<
    ColumnKey,
    number
  >,
);

// Only the Summary column can be user-frozen (sticky left). The Actions column
// is always pinned to the right edge of the table.
const summaryFrozen = ref(false);

const activeColumns = computed<ColumnDef[]>(() =>
  COLUMNS.filter((c) => visibleColumns.value[c.key]),
);

// The rightmost visible non-actions column. Its <col> renders with no
// explicit width so table-layout: fixed gives it the leftover space — this
// keeps the fixed-width columns (select / actions) at their declared widths
// without needing a visible spacer column.
const stretchKey = computed<ColumnKey | null>(() => {
  for (let i = activeColumns.value.length - 1; i >= 0; i--) {
    const c = activeColumns.value[i];
    if (c.key !== "actions") return c.key;
  }
  return null;
});

// Sum of every visible column's declared width (using the stretch column's
// minWidth for its floor). Applied as min-width on the table so the wrapper
// scrolls horizontally when this exceeds the container width, instead of
// the table being squashed by width: 100%.
const tableMinWidth = computed<number>(() => {
  let total = 0;
  for (const col of activeColumns.value) {
    if (col.key === stretchKey.value) {
      total += col.minWidth;
    } else {
      total += colWidth(col.key);
    }
  }
  return total;
});

function colWidth(key: ColumnKey): number {
  if (FIXED_WIDTH_COLUMNS.has(key)) {
    const def = COLUMNS.find((c) => c.key === key);
    return def?.defaultWidth ?? 0;
  }
  return columnWidths.value[key];
}

function toggleColumn(key: ColumnKey): void {
  // Don't allow hiding the Summary column — there must always be something
  // to anchor the row.
  if (key === "summary") return;
  visibleColumns.value = {
    ...visibleColumns.value,
    [key]: !visibleColumns.value[key],
  };
}

function resetColumns(): void {
  visibleColumns.value = {
    select: true,
    summary: true,
    type: false,
    key: false,
    state: true,
    priority: true,
    assignee: true,
    reporter: false,
    labels: false,
    components: false,
    sprint: false,
    storyPoints: false,
    dueDate: false,
    attachments: false,
    updated: true,
    created: false,
    createdBy: false,
    actions: true,
  };
  for (const c of COLUMNS) {
    columnWidths.value[c.key] = c.defaultWidth;
  }
  summaryFrozen.value = false;
}

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
const assigneeFilter = ref<Set<string>>(new Set());

const hideDone = ref(false);
const showHierarchy = ref(true);
const expandedIds = ref<Set<string>>(new Set());

// --- Sorting state ---
const sortBy = ref<WorkItemSortBy>("updatedAt");
const sortDir = ref<"asc" | "desc">("desc");

function setSort(field: WorkItemSortBy): void {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = field;
    sortDir.value = "asc";
  }
}

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

// Client-side rank overrides (session-only). Maps item._id -> sequence number;
// smaller is higher (top), larger is lower (bottom). Items without an override
// keep server-sort order.
const rankOverrides = ref<Map<string, number>>(new Map());
let rankSeq = 0;

watch(
  [stateFilter, typeFilter, priorityFilter, assigneeFilter, hideDone],
  () => {
    page.value = 1;
  },
);

async function fetchPage(): Promise<void> {
  if (!project.value?._id) return;
  loading.value = true;
  loadError.value = null;
  try {
    const result = await workItemService.listWorkItems({
      projectId: project.value._id,
      type: typeFilter.value === "ALL" ? undefined : typeFilter.value,
      state: stateFilter.value === "ALL" ? undefined : stateFilter.value,
      assigneeIds:
        assigneeFilter.value.size > 0 ? [...assigneeFilter.value] : undefined,
      search: debouncedSearch.value || undefined,
      hideDone: hideDone.value || undefined,
      page: page.value,
      limit: limit.value,
      sortBy: sortBy.value,
      sortDir: sortDir.value,
    });
    // Server doesn't filter by priority — apply client-side on the page.
    let pageItems =
      priorityFilter.value === "ALL"
        ? result.items
        : result.items.filter((i) => i.priority === priorityFilter.value);

    // Apply session-only rank overrides
    if (rankOverrides.value.size > 0) {
      pageItems = [...pageItems].sort((a, b) => {
        const ra = rankOverrides.value.get(a._id);
        const rb = rankOverrides.value.get(b._id);
        if (ra === undefined && rb === undefined) return 0;
        if (ra === undefined) return 1;
        if (rb === undefined) return -1;
        return ra - rb;
      });
    }

    items.value = pageItems;
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
    assigneeFilter,
    hideDone,
    sortBy,
    sortDir,
  ],
  () => {
    void fetchPage();
  },
);

onMounted(async () => {
  await userStore.fetchUsers().catch(() => undefined);
  if (project.value?._id) {
    void sprintStore.fetchSprints(project.value._id).catch(() => undefined);
  }
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

// --- Member avatars + assignee filter ---
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

function selectAssignee(id: string | "none"): void {
  const next = new Set(assigneeFilter.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  assigneeFilter.value = next;
}

function isAssigneeSelected(id: string | "none"): boolean {
  return assigneeFilter.value.has(id);
}

function clearAssigneeFilter(): void {
  assigneeFilter.value = new Set();
}

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function sprintName(id: string | null): string {
  if (!id) return "—";
  return sprintStore.findById(id)?.name ?? "—";
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
const assigneeFilterLabel = computed(() => {
  if (assigneeFilter.value.size === 0) return "";
  const names = [...assigneeFilter.value].map((id) =>
    id === "none" ? "Unassigned" : memberName(id),
  );
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
});

function clearFilters(): void {
  stateFilter.value = "ALL";
  typeFilter.value = "ALL";
  priorityFilter.value = "ALL";
  assigneeFilter.value = new Set();
}

const activeFilterCount = computed(() => {
  let n = 0;
  if (stateFilter.value !== "ALL") n++;
  if (typeFilter.value !== "ALL") n++;
  if (priorityFilter.value !== "ALL") n++;
  if (assigneeFilter.value.size > 0) n++;
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

// --- Row actions ---
async function rankToTop(item: WorkItem): Promise<void> {
  rankSeq -= 1;
  const next = new Map(rankOverrides.value);
  next.set(item._id, rankSeq);
  rankOverrides.value = next;
  items.value = [...items.value].sort((a, b) => {
    const ra = rankOverrides.value.get(a._id);
    const rb = rankOverrides.value.get(b._id);
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}

async function rankToBottom(item: WorkItem): Promise<void> {
  rankSeq += 1;
  const next = new Map(rankOverrides.value);
  next.set(item._id, 1_000_000 + rankSeq);
  rankOverrides.value = next;
  items.value = [...items.value].sort((a, b) => {
    const ra = rankOverrides.value.get(a._id);
    const rb = rankOverrides.value.get(b._id);
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}

async function deleteRow(item: WorkItem): Promise<void> {
  const ok = window.confirm(`Delete "${item.title}"? This cannot be undone.`);
  if (!ok) return;
  try {
    await workItemService.deleteWorkItem(item._id);
    await fetchPage();
    void reloadTasks();
  } catch (err) {
    if (axios.isAxiosError(err)) {
      loadError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        "Failed to delete work item.";
    } else {
      loadError.value = "Failed to delete work item.";
    }
  }
}

async function copyLink(item: WorkItem): Promise<void> {
  const url = `${window.location.origin}/app/work-items/${item._id}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt("Copy link:", url);
  }
}

// --- Column resize (drag handle on the right of <th>) ---
const resizing = ref<ColumnKey | null>(null);
let resizeStartX = 0;
let resizeStartWidth = 0;

function startResize(e: MouseEvent, key: ColumnKey): void {
  if (FIXED_WIDTH_COLUMNS.has(key)) return;
  e.preventDefault();
  e.stopPropagation();
  resizing.value = key;
  resizeStartX = e.clientX;
  resizeStartWidth = columnWidths.value[key];
  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", endResize);
}

function onResizeMove(e: MouseEvent): void {
  const key = resizing.value;
  if (!key) return;
  const def = COLUMNS.find((c) => c.key === key);
  if (!def) return;
  const next = Math.max(
    def.minWidth,
    resizeStartWidth + (e.clientX - resizeStartX),
  );
  columnWidths.value = { ...columnWidths.value, [key]: next };
}

function endResize(): void {
  resizing.value = null;
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", endResize);
}

onUnmounted(() => {
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", endResize);
});

// Programmatic resize (from header menu): nudge width by +40px
function nudgeWidth(key: ColumnKey): void {
  if (FIXED_WIDTH_COLUMNS.has(key)) return;
  const def = COLUMNS.find((c) => c.key === key);
  if (!def) return;
  columnWidths.value = {
    ...columnWidths.value,
    [key]: columnWidths.value[key] + 40,
  };
}

function toggleFreeze(key: ColumnKey): void {
  if (key !== "summary") return;
  summaryFrozen.value = !summaryFrozen.value;
}

// --- Row selection (visual-only) ---
const selectedRows = ref<Set<string>>(new Set());

function isRowSelected(id: string): boolean {
  return selectedRows.value.has(id);
}

function toggleRow(id: string, value: boolean | "indeterminate"): void {
  const next = new Set(selectedRows.value);
  if (value === true) next.add(id);
  else next.delete(id);
  selectedRows.value = next;
}

const pageSelectionState = computed<boolean | "indeterminate">(() => {
  if (flatRows.value.length === 0) return false;
  let selected = 0;
  for (const r of flatRows.value) {
    if (selectedRows.value.has(r.item._id)) selected++;
  }
  if (selected === 0) return false;
  if (selected === flatRows.value.length) return true;
  return "indeterminate";
});

function togglePageSelection(value: boolean | "indeterminate"): void {
  const next = new Set(selectedRows.value);
  if (value === true) {
    for (const r of flatRows.value) next.add(r.item._id);
  } else {
    for (const r of flatRows.value) next.delete(r.item._id);
  }
  selectedRows.value = next;
}
</script>

<template>
  <div class="flex flex-col gap-3 h-full">
    <!-- Toolbar header -->
    <div class="shrink-0 flex flex-wrap items-center justify-between gap-2">
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
        <!-- Clickable member avatars (multi-select filter by assignee) -->
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

        <!-- Columns visibility dropdown -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="gap-1.5">
              <VsxIcon iconName="RowVertical" class="size-4" />
              <span>Columns</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            class="min-w-52 max-h-80 overflow-y-auto"
          >
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            <div
              v-for="col in COLUMNS.filter(
                (c) => c.label && c.key !== 'select',
              )"
              :key="`col-${col.key}`"
              class="relative flex items-center justify-between gap-3 px-2 py-1.5 text-sm rounded-sm select-none"
              :class="
                col.key === 'summary'
                  ? 'opacity-50 pointer-events-none'
                  : 'cursor-pointer hover:bg-accent'
              "
              @click="toggleColumn(col.key)"
            >
              <span>{{ col.label }}</span>
              <Switch
                tabindex="-1"
                :model-value="visibleColumns[col.key]"
                :disabled="col.key === 'summary'"
                class="pointer-events-none"
              />
            </div>
            <div
              class="relative flex items-center justify-between gap-3 px-2 py-1.5 text-sm rounded-sm select-none cursor-pointer hover:bg-accent"
              @click="toggleColumn('actions')"
            >
              <span>Actions</span>
              <Switch
                tabindex="-1"
                :model-value="visibleColumns.actions"
                class="pointer-events-none"
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="resetColumns">
              <VsxIcon iconName="Refresh" class="size-4" />
              <span>Reset columns</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
          <DropdownMenuContent
            align="end"
            class="min-w-60 max-h-96 overflow-y-auto"
          >
            <div
              class="relative flex items-center justify-between gap-3 px-2 py-1.5 text-sm rounded-sm select-none cursor-pointer hover:bg-accent"
              @click="hideDone = !hideDone"
            >
              <span>{{
                hideDone ? "Show done work items" : "Hide done work items"
              }}</span>
              <Switch
                tabindex="-1"
                :model-value="hideDone"
                class="pointer-events-none"
              />
            </div>
            <div
              class="relative flex items-center justify-between gap-3 px-2 py-1.5 text-sm rounded-sm select-none cursor-pointer hover:bg-accent"
              @click="showHierarchy = !showHierarchy"
            >
              <span>{{
                showHierarchy ? "Hide hierarchy" : "Show hierarchy"
              }}</span>
              <Switch
                tabindex="-1"
                :model-value="showHierarchy"
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
      class="shrink-0 flex flex-wrap items-center gap-1.5 text-xs"
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
      <span
        v-if="assigneeFilter.size > 0"
        class="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5"
      >
        Assignee: {{ assigneeFilterLabel }}
        <button
          type="button"
          class="hover:text-destructive"
          @click="clearAssigneeFilter"
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

    <div v-else class="flex-1 min-h-0 rounded-lg border bg-card overflow-auto">
      <table
        class="w-full h-full text-sm border-separate border-spacing-0 table-fixed"
        :style="{ minWidth: `${tableMinWidth}px` }"
      >
        <colgroup>
          <col
            v-for="col in activeColumns"
            :key="`cg-${col.key}`"
            :style="
              col.key === stretchKey
                ? undefined
                : { width: `${colWidth(col.key)}px` }
            "
          />
        </colgroup>

        <thead class="text-muted-foreground">
          <tr>
            <th
              v-for="col in activeColumns"
              :key="`th-${col.key}`"
              class="group/th sticky top-0 z-10 bg-[#f6f6f6] text-left font-medium px-4 py-2 border-r last:border-r-0 whitespace-nowrap"
              :class="[
                col.key === 'select' ? 'left-0 z-20' : '',
                col.key === 'summary' && summaryFrozen ? 'z-20' : '',
                col.key === 'actions'
                  ? 'right-0 z-20 [box-shadow:-1px_0_0_var(--border),0_1px_0_var(--border)]'
                  : '[box-shadow:0_1px_0_var(--border)]',
              ]"
              :style="
                col.key === 'summary' && summaryFrozen
                  ? { left: `${colWidth('select')}px` }
                  : undefined
              "
            >
              <!-- Select column header: page-level checkbox -->
              <div
                v-if="col.key === 'select'"
                class="flex items-center justify-center"
                @click.stop
              >
                <Checkbox
                  :model-value="pageSelectionState"
                  aria-label="Select all rows on this page"
                  @update:model-value="togglePageSelection"
                />
              </div>

              <!-- Action column header: blank (no menu) -->
              <div v-else-if="col.key === 'actions'" class="sr-only">
                Actions
              </div>

              <!-- Standard column header -->
              <div v-else class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1">
                  {{ col.label }}
                  <VsxIcon
                    v-if="col.sortBy && sortBy === col.sortBy"
                    :iconName="sortDir === 'asc' ? 'ArrowUp2' : 'ArrowDown2'"
                    class="size-3.5 text-primary"
                  />
                </span>

                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <button
                      type="button"
                      class="opacity-0 group-hover/th:opacity-100 data-[state=open]:opacity-100 inline-flex items-center justify-center size-5 rounded hover:bg-accent transition-opacity"
                      :aria-label="`${col.label} options`"
                    >
                      <VsxIcon iconName="More" class="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    class="min-w-48 max-h-80 overflow-y-auto"
                  >
                    <DropdownMenuLabel>{{ col.label }}</DropdownMenuLabel>
                    <DropdownMenuItem
                      v-if="col.sortBy"
                      @select="setSort(col.sortBy!)"
                    >
                      <VsxIcon
                        :iconName="
                          sortBy === col.sortBy && sortDir === 'asc'
                            ? 'ArrowDown2'
                            : 'ArrowUp2'
                        "
                        class="size-4"
                      />
                      <span>
                        {{
                          sortBy === col.sortBy
                            ? sortDir === "asc"
                              ? "Sort descending"
                              : "Sort ascending"
                            : "Sort by this column"
                        }}
                      </span>
                    </DropdownMenuItem>
                    <!-- Only Summary can be frozen by the user -->
                    <DropdownMenuItem
                      v-if="col.key === 'summary'"
                      @select="toggleFreeze('summary')"
                    >
                      <VsxIcon
                        iconName="Lock1"
                        class="size-4"
                        :class="summaryFrozen ? 'text-primary' : ''"
                      />
                      <span>
                        {{
                          summaryFrozen ? "Unfreeze column" : "Freeze column"
                        }}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem @select="nudgeWidth(col.key)">
                      <VsxIcon iconName="Maximize" class="size-4" />
                      <span>Resize column (+40px)</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      :disabled="col.key === 'summary'"
                      @select="toggleColumn(col.key)"
                    >
                      <VsxIcon iconName="EyeSlash" class="size-4" />
                      <span>Hide column</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <!-- Drag handle for resize. Skipped for fixed columns and for
                   the stretch column (which auto-sizes to the leftover width
                   and would ignore any user-set width). -->
              <span
                v-if="
                  col.key !== 'actions' &&
                  col.key !== 'select' &&
                  col.key !== stretchKey
                "
                class="absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none hover:bg-primary/40"
                :class="resizing === col.key ? 'bg-primary/60' : ''"
                @mousedown="startResize($event, col.key)"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in flatRows"
            :key="row.item._id"
            class="cursor-pointer h-13 [&>td]:border-t"
            :class="
              isRowSelected(row.item._id)
                ? 'bg-primary/5 hover:bg-primary/10'
                : 'hover:bg-accent/40'
            "
            @click="openItem(row.item._id)"
          >
            <template
              v-for="col in activeColumns"
              :key="`td-${col.key}-${row.item._id}`"
            >
              <td
                v-if="col.key === 'select'"
                class="p-0 align-middle h-13 border-r last:border-r-0 text-center sticky left-0 z-10"
                :class="
                  isRowSelected(row.item._id) ? 'bg-primary/5' : 'bg-card'
                "
                @click.stop
              >
                <div class="flex items-center justify-center">
                  <Checkbox
                    :model-value="isRowSelected(row.item._id)"
                    :aria-label="`Select ${row.item.title}`"
                    @update:model-value="toggleRow(row.item._id, $event)"
                  />
                </div>
              </td>

              <td
                v-else-if="col.key === 'summary'"
                class="p-0 align-middle h-13 border-r last:border-r-0"
                :class="
                  summaryFrozen
                    ? isRowSelected(row.item._id)
                      ? 'sticky z-10 bg-primary/5'
                      : 'sticky z-10 bg-card '
                    : ''
                "
                :style="
                  summaryFrozen
                    ? { left: `${colWidth('select')}px` }
                    : undefined
                "
              >
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
                      ((row.hasChildren && 'ml-3') || (row.depth > 0 && 'ml-2'))
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

              <td
                v-else-if="col.key === 'state'"
                class="px-4 py-2.5 border-r last:border-r-0"
              >
                <span
                  :class="[
                    'inline-block rounded px-2 py-0.5 text-xs',
                    STATE_BADGE[row.item.state],
                  ]"
                >
                  {{ STATE_LABELS[row.item.state] }}
                </span>
              </td>

              <td
                v-else-if="col.key === 'priority'"
                class="px-4 py-2.5 border-r last:border-r-0"
              >
                <span
                  :class="[
                    'inline-block rounded px-2 py-0.5 text-xs capitalize',
                    PRIORITY_BADGE[row.item.priority],
                  ]"
                >
                  {{ row.item.priority }}
                </span>
              </td>

              <td
                v-else-if="col.key === 'assignee'"
                class="px-4 py-2.5 border-r last:border-r-0"
              >
                <div
                  v-if="row.item.assigneeId"
                  class="flex items-center gap-2 min-w-0"
                >
                  <Avatar class="size-6 shrink-0">
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
                v-else-if="col.key === 'type'"
                class="px-4 py-2.5 border-r last:border-r-0"
              >
                <span class="inline-flex items-center gap-1.5 text-xs">
                  <VsxIcon
                    :iconName="TYPE_META[row.item.type].icon"
                    class="size-4 shrink-0"
                    :class="TYPE_META[row.item.type].text"
                  />
                  {{ TYPE_META[row.item.type].label }}
                </span>
              </td>

              <td
                v-else-if="col.key === 'key'"
                class="px-4 py-2.5 border-r last:border-r-0 whitespace-nowrap"
              >
                <span class="font-mono text-xs text-muted-foreground">
                  {{ row.item.key }}
                </span>
              </td>

              <td
                v-else-if="col.key === 'reporter'"
                class="px-4 py-2.5 border-r last:border-r-0"
              >
                <div
                  v-if="row.item.reporterId"
                  class="flex items-center gap-2 min-w-0"
                >
                  <Avatar class="size-6 shrink-0">
                    <AvatarFallback class="text-[10px]">
                      {{ memberInitials(row.item.reporterId) }}
                    </AvatarFallback>
                  </Avatar>
                  <span class="text-xs truncate">
                    {{ memberName(row.item.reporterId) }}
                  </span>
                </div>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>

              <td
                v-else-if="col.key === 'labels'"
                class="px-4 py-2.5 border-r last:border-r-0"
              >
                <div
                  v-if="row.item.labels.length"
                  class="flex flex-wrap items-center gap-1"
                >
                  <span
                    v-for="label in row.item.labels"
                    :key="label"
                    class="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px]"
                  >
                    {{ label }}
                  </span>
                </div>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>

              <td
                v-else-if="col.key === 'components'"
                class="px-4 py-2.5 border-r last:border-r-0"
              >
                <div
                  v-if="itemComponents(row.item).length"
                  class="flex flex-wrap items-center gap-1"
                >
                  <span
                    v-for="c in itemComponents(row.item)"
                    :key="c._id"
                    class="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px]"
                  >
                    {{ c.name }}
                  </span>
                </div>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>

              <td
                v-else-if="col.key === 'sprint'"
                class="px-4 py-2.5 border-r last:border-r-0 whitespace-nowrap"
              >
                <span v-if="row.item.sprintId" class="text-xs truncate">
                  {{ sprintName(row.item.sprintId) }}
                </span>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>

              <td
                v-else-if="col.key === 'storyPoints'"
                class="px-4 py-2.5 border-r last:border-r-0 text-center"
              >
                <span
                  v-if="row.item.storyPoints != null"
                  class="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs"
                >
                  {{ row.item.storyPoints }}
                </span>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>

              <td
                v-else-if="col.key === 'dueDate'"
                class="px-4 py-2.5 border-r last:border-r-0 whitespace-nowrap text-xs text-muted-foreground"
              >
                {{ row.item.dueDate ? formatDate(row.item.dueDate) : "—" }}
              </td>

              <td
                v-else-if="col.key === 'attachments'"
                class="px-4 py-2.5 border-r last:border-r-0 text-center"
              >
                <span
                  v-if="row.item.attachments.length"
                  class="inline-flex items-center gap-1 text-xs"
                >
                  <VsxIcon iconName="Paperclip2" class="size-3.5" />
                  {{ row.item.attachments.length }}
                </span>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </td>

              <td
                v-else-if="col.key === 'updated'"
                class="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground border-r last:border-r-0"
              >
                {{ formatDateTime(row.item.updatedAt) }}
              </td>

              <td
                v-else-if="col.key === 'created'"
                class="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground border-r last:border-r-0"
              >
                {{ formatDateTime(row.item.createdAt) }}
              </td>

              <td
                v-else-if="col.key === 'createdBy'"
                class="px-4 py-2.5 border-r last:border-r-0"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <Avatar class="size-6 shrink-0">
                    <AvatarFallback class="text-[10px]">
                      {{ memberInitials(row.item.createdBy) }}
                    </AvatarFallback>
                  </Avatar>
                  <span class="text-xs truncate">
                    {{ memberName(row.item.createdBy) }}
                  </span>
                </div>
              </td>

              <td
                v-else-if="col.key === 'actions'"
                class="px-2 py-2.5 border-r last:border-r-0 text-center sticky right-0 z-10 [box-shadow:-1px_0_0_var(--border)]"
                :class="
                  isRowSelected(row.item._id) ? 'bg-primary/5' : 'bg-card'
                "
                @click.stop
              >
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center size-7 rounded hover:bg-accent text-muted-foreground"
                      :aria-label="`Actions for ${row.item.title}`"
                    >
                      <VsxIcon iconName="More" class="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    class="min-w-52 max-h-96 overflow-y-auto"
                  >
                    <DropdownMenuItem @select="openItem(row.item._id)">
                      <VsxIcon iconName="Eye" class="size-4" />
                      <span>View work item</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem @select="rankToTop(row.item)">
                      <VsxIcon iconName="ArrowUp2" class="size-4" />
                      <span>Rank to top</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem @select="rankToBottom(row.item)">
                      <VsxIcon iconName="ArrowDown2" class="size-4" />
                      <span>Rank to bottom</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem @select="copyLink(row.item)">
                      <VsxIcon iconName="Link" class="size-4" />
                      <span>Copy link</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="row.item.assigneeId"
                      @select="selectAssignee(row.item.assigneeId!)"
                    >
                      <VsxIcon iconName="UserSearch" class="size-4" />
                      <span>Filter by assignee</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      @select="deleteRow(row.item)"
                    >
                      <VsxIcon iconName="Trash" class="size-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </template>
          </tr>

          <!-- Filler row: stretches to fill remaining vertical space so each
               column's right border extends to the bottom of the table. -->
          <tr aria-hidden="true" class="h-full pointer-events-none">
            <td
              v-for="col in activeColumns"
              :key="`filler-${col.key}`"
              class="border-t border-r last:border-r-0 bg-card"
              :class="[
                col.key === 'select' ? 'sticky left-0 z-10' : '',
                col.key === 'summary' && summaryFrozen ? 'sticky z-10' : '',
                col.key === 'actions'
                  ? 'sticky right-0 z-10 [box-shadow:-1px_0_0_var(--border)]'
                  : '',
              ]"
              :style="
                col.key === 'summary' && summaryFrozen
                  ? { left: `${colWidth('select')}px` }
                  : undefined
              "
            />
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div
      v-if="total > 0"
      class="shrink-0 flex flex-wrap items-center justify-between gap-3 px-1 pt-1"
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
