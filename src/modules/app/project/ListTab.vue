<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { VsxIcon } from "vue-iconsax";
import axios from "axios";
import { useAuthStore } from "@/store/auth";
import { useComponentStore } from "@/store/component";
import { useSprintStore } from "@/store/sprint";
import { useUserLookup } from "@/store/user";
import * as workItemService from "@/services/workItem.service";
import type {
  ProjectComponent,
  UpdateWorkItemPayload,
  WorkItem,
  WorkItemPriority,
  WorkItemSortBy,
  WorkItemState,
  WorkItemType,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DynamicDataTable, type ColumnDef } from "@/components/data-table";
import BulkUpdateFieldsDialog from "./BulkUpdateFieldsDialog.vue";
import ConnectParentDialog from "./ConnectParentDialog.vue";
import { useProjectContext } from "./projectContext";

const router = useRouter();
const auth = useAuthStore();
const componentStore = useComponentStore();
const sprintStore = useSprintStore();
const userStore = useUserLookup();
const { project, tasksError, canCreateTask, openCreateTask, reloadTasks } =
  useProjectContext();

// --- Static metadata ---
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

const STATE_DOT: Record<WorkItemState, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-blue-500",
  IN_REVIEW: "bg-purple-500",
  DONE: "bg-emerald-500",
  BLOCKED: "bg-red-500",
  CANCELLED: "bg-gray-400",
};

const EDITABLE_STATES: { value: WorkItemState; label: string }[] = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "DONE", label: "Done" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "CANCELLED", label: "Cancelled" },
];

const EDITABLE_PRIORITIES: { value: WorkItemPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

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
  subtask: { icon: "TickSquare", text: "text-emerald-500", label: "Subtask" },
};

// --- Column config ---
const columns: ColumnDef[] = [
  {
    key: "summary",
    label: "Summary",
    sortBy: "title",
    defaultWidth: 360,
    minWidth: 200,
    alwaysVisible: true,
    freezable: true,
    cellClass: "!p-0",
  },
  {
    key: "type",
    label: "Type",
    defaultWidth: 120,
    minWidth: 90,
    defaultVisible: false,
  },
  {
    key: "key",
    label: "Key",
    sortBy: "key",
    defaultWidth: 110,
    minWidth: 80,
    defaultVisible: false,
    whitespaceNowrap: true,
  },
  {
    key: "state",
    label: "State",
    sortBy: "state",
    defaultWidth: 140,
    minWidth: 100,
    cellClass: "!p-0",
  },
  {
    key: "priority",
    label: "Priority",
    sortBy: "priority",
    defaultWidth: 120,
    minWidth: 90,
    cellClass: "!p-0",
  },
  {
    key: "assignee",
    label: "Assignee",
    defaultWidth: 200,
    minWidth: 140,
    cellClass: "!p-0",
  },
  {
    key: "reporter",
    label: "Reporter",
    defaultWidth: 200,
    minWidth: 140,
    defaultVisible: true,
    cellClass: "!p-0",
  },
  {
    key: "labels",
    label: "Labels",
    defaultWidth: 200,
    minWidth: 140,
    defaultVisible: false,
  },
  {
    key: "components",
    label: "Components",
    defaultWidth: 200,
    minWidth: 140,
    defaultVisible: false,
  },
  {
    key: "sprint",
    label: "Sprint",
    defaultWidth: 160,
    minWidth: 120,
    defaultVisible: false,
    whitespaceNowrap: true,
  },
  {
    key: "storyPoints",
    label: "Story points",
    defaultWidth: 110,
    minWidth: 80,
    defaultVisible: false,
    align: "center",
  },
  {
    key: "dueDate",
    label: "Due date",
    defaultWidth: 140,
    minWidth: 110,
    defaultVisible: true,
    whitespaceNowrap: true,
    cellClass: "!p-0",
  },
  {
    key: "attachments",
    label: "Attachments",
    defaultWidth: 130,
    minWidth: 100,
    defaultVisible: false,
    align: "center",
  },
  {
    key: "updated",
    label: "Updated",
    sortBy: "updatedAt",
    defaultWidth: 180,
    minWidth: 140,
    whitespaceNowrap: true,
  },
  {
    key: "created",
    label: "Created",
    sortBy: "createdAt",
    defaultWidth: 180,
    minWidth: 140,
    defaultVisible: false,
    whitespaceNowrap: true,
  },
  {
    key: "createdBy",
    label: "Created by",
    defaultWidth: 200,
    minWidth: 140,
    defaultVisible: false,
  },
];

// --- Filters & UI state ---
const search = ref("");

const stateFilter = ref<WorkItemState | "ALL">("ALL");
const typeFilter = ref<WorkItemType | "ALL">("ALL");
const priorityFilter = ref<WorkItemPriority | "ALL">("ALL");
const assigneeFilter = ref<Set<string>>(new Set());

const hideDone = ref(false);
const showHierarchy = ref(true);
const expandedIds = ref<Set<string>>(new Set());

// --- Sort + pagination (v-model'd into DynamicDataTable) ---
const sortBy = ref<WorkItemSortBy | null>("updatedAt");
const sortDir = ref<"asc" | "desc">("desc");
const page = ref(1);
const limit = ref(25);

const total = ref(0);
const items = ref<WorkItem[]>([]);
const loading = ref(false);
const loadError = ref<string | null>(null);
const selectedRows = ref<Set<string>>(new Set());

// Client-side rank overrides (session-only).
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
      search: search.value || undefined,
      hideDone: hideDone.value || undefined,
      page: page.value,
      limit: limit.value,
      sortBy: sortBy.value ?? "updatedAt",
      sortDir: sortDir.value,
    });
    let pageItems =
      priorityFilter.value === "ALL"
        ? result.items
        : result.items.filter((i) => i.priority === priorityFilter.value);

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

    // Backfill missing ancestors on a working copy BEFORE assigning items, so
    // the skeleton (gated on items.length === 0) stays up across the extra
    // getWorkItem calls and the user never sees orphan rows flicker.
    const { items: withParents, expanded } =
      await backfillMissingParents(pageItems);
    items.value = withParents;
    total.value = result.total;
    if (expanded.length > 0) {
      const next = new Set(expandedIds.value);
      for (const id of expanded) next.add(id);
      expandedIds.value = next;
    }
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

// Hierarchy view requires an item's parent to be present in `items` for the
// `childrenByParent` bucketing to nest it correctly. The paginated/sorted page
// often omits ancestors (e.g. a segment that hasn't been recently updated), so
// children render as orphan roots. Fetch any missing parents up the chain and
// return them as additions, plus the ids to auto-expand. Operates on a working
// copy so the caller can keep the skeleton up until everything is ready.
async function backfillMissingParents(
  initial: WorkItem[],
): Promise<{ items: WorkItem[]; expanded: string[] }> {
  let current = initial;
  const expanded: string[] = [];
  let safety = 8;
  while (safety-- > 0) {
    const known = new Set(current.map((it) => it._id));
    const missing = new Set<string>();
    for (const it of current) {
      if (it.parentId && !known.has(it.parentId)) missing.add(it.parentId);
    }
    if (missing.size === 0) break;
    const results = await Promise.all(
      [...missing].map((id) =>
        workItemService.getWorkItem(id).catch(() => null),
      ),
    );
    const fetched = results.filter((r): r is WorkItem => r !== null);
    if (fetched.length === 0) break;
    for (const it of fetched) expanded.push(it._id);
    current = [...fetched, ...current];
  }
  return { items: current, expanded };
}

watch(
  [
    () => project.value?._id,
    page,
    limit,
    search,
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

onMounted(() => {
  if (project.value?._id) {
    void sprintStore.fetchSprints(project.value._id).catch(() => undefined);
  }
  void fetchPage();
});

// --- Hierarchy flattening ---
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

function dateOnly(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

const isPrivileged = computed<boolean>(() => {
  const role = auth.user?.role;
  return role === "manager" || role === "admin" || role === "super_admin";
});

function canEditItem(item: WorkItem): boolean {
  if (!auth.user) return false;
  if (isPrivileged.value) return true;
  return (
    item.assigneeId === auth.user._id ||
    item.reporterId === auth.user._id ||
    item.createdBy === auth.user._id
  );
}

async function patchItem(
  item: WorkItem,
  payload: UpdateWorkItemPayload,
): Promise<void> {
  loadError.value = null;
  try {
    const updated = await workItemService.updateWorkItem(item._id, payload);
    items.value = items.value.map((it) =>
      it._id === updated._id ? updated : it,
    );
    void reloadTasks();
  } catch (err) {
    if (axios.isAxiosError(err)) {
      loadError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        "Failed to update work item.";
    } else {
      loadError.value = "Failed to update work item.";
    }
  }
}

async function changeState(
  item: WorkItem,
  state: WorkItemState,
): Promise<void> {
  if (item.state === state) return;
  await patchItem(item, { state });
}

async function changePriority(
  item: WorkItem,
  priority: WorkItemPriority,
): Promise<void> {
  if (item.priority === priority) return;
  await patchItem(item, { priority });
}

async function changeAssignee(
  item: WorkItem,
  assigneeId: string | null,
): Promise<void> {
  if ((item.assigneeId ?? null) === assigneeId) return;
  await patchItem(item, { assigneeId });
}

async function changeReporter(
  item: WorkItem,
  reporterId: string,
): Promise<void> {
  if (item.reporterId === reporterId) return;
  await patchItem(item, { reporterId });
}

async function changeDueDate(
  item: WorkItem,
  event: Event | null,
): Promise<void> {
  let next: string | null = null;
  if (event) {
    const v = (event.target as HTMLInputElement).value;
    if (v) next = new Date(v).toISOString();
  }
  if ((item.dueDate ?? null) === next) return;
  await patchItem(item, { dueDate: next });
}

// --- Inline title editing (double-click on summary cell) ---
const editingId = ref<string | null>(null);
const editingTitle = ref<string>("");
const editingError = ref<string | null>(null);
const editingSaving = ref<boolean>(false);
let titleClickTimer: number | null = null;
let lastEditExitAt = 0;
let focusedEditId: string | null = null;

function setEditInputRef(el: unknown): void {
  if (!(el instanceof HTMLInputElement)) return;
  if (focusedEditId === editingId.value) return;
  focusedEditId = editingId.value;
  el.value = editingTitle.value;
  void nextTick(() => {
    el.focus();
    el.select();
  });
}

function startEditTitle(item: WorkItem): void {
  if (!canEditItem(item)) return;
  editingId.value = item._id;
  editingTitle.value = item.title;
  editingError.value = null;
}

function cancelEditTitle(): void {
  editingId.value = null;
  editingTitle.value = "";
  editingError.value = null;
  lastEditExitAt = Date.now();
  focusedEditId = null;
}

async function saveEditTitle(item: WorkItem, raw: string): Promise<void> {
  if (editingId.value !== item._id || editingSaving.value) return;
  const next = raw.trim();
  if (next === item.title) {
    cancelEditTitle();
    return;
  }
  if (next.length < 2) {
    editingError.value = "Title must be at least 2 characters";
    return;
  }
  editingSaving.value = true;
  try {
    const updated = await workItemService.updateWorkItem(item._id, {
      title: next,
    });
    items.value = items.value.map((it) =>
      it._id === updated._id ? updated : it,
    );
    void reloadTasks();
    cancelEditTitle();
  } catch (err) {
    if (axios.isAxiosError(err)) {
      editingError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        "Failed to update title.";
    } else {
      editingError.value = "Failed to update title.";
    }
  } finally {
    editingSaving.value = false;
  }
}

function onTitleKey(event: KeyboardEvent, item: WorkItem): void {
  const input = event.target as HTMLInputElement;
  if (event.key === "Enter") {
    event.preventDefault();
    void saveEditTitle(item, input.value);
  } else if (event.key === "Escape") {
    event.preventDefault();
    cancelEditTitle();
  }
}

function onTitleBlur(event: FocusEvent, item: WorkItem): void {
  if (editingId.value !== item._id) return;
  const input = event.target as HTMLInputElement;
  void saveEditTitle(item, input.value);
}

function onTitleClick(event: MouseEvent, item: WorkItem): void {
  if (editingId.value === item._id) return;
  event.stopPropagation();
  // Suppress click that fired as part of blur-to-save (clicking outside input)
  if (Date.now() - lastEditExitAt < 300) return;
  if (titleClickTimer !== null) {
    window.clearTimeout(titleClickTimer);
    titleClickTimer = null;
    return;
  }
  titleClickTimer = window.setTimeout(() => {
    titleClickTimer = null;
    openItem(item._id);
  }, 250);
}

function onTitleDblClick(event: MouseEvent, item: WorkItem): void {
  event.stopPropagation();
  event.preventDefault();
  if (titleClickTimer !== null) {
    window.clearTimeout(titleClickTimer);
    titleClickTimer = null;
  }
  startEditTitle(item);
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

// --- Filter labels & chip helpers ---
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

const tableError = computed(() => loadError.value ?? tasksError.value ?? null);

// --- Export ---
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

function onRowClick(row: FlatRow): void {
  openItem(row.item._id);
}

function getRowId(row: FlatRow): string {
  return row.item._id;
}

// --- Bulk selection actions ---
const selectedCount = computed<number>(() => selectedRows.value.size);

const selectedItems = computed<WorkItem[]>(() =>
  items.value.filter((it) => selectedRows.value.has(it._id)),
);

const canBulkEdit = computed<boolean>(() =>
  selectedItems.value.every((it) => canEditItem(it)),
);

function selectAllRows(): void {
  const next = new Set<string>();
  for (const row of flatRows.value) next.add(row.item._id);
  selectedRows.value = next;
}

function clearSelection(): void {
  selectedRows.value = new Set();
}

async function bulkChangeStatus(state: WorkItemState): Promise<void> {
  const targets = selectedItems.value.filter(
    (it) => canEditItem(it) && it.state !== state,
  );
  if (targets.length === 0) return;
  loadError.value = null;
  try {
    await Promise.all(
      targets.map((it) => workItemService.updateWorkItem(it._id, { state })),
    );
    await fetchPage();
    void reloadTasks();
  } catch (err) {
    if (axios.isAxiosError(err)) {
      loadError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        "Failed to update work items.";
    } else {
      loadError.value = "Failed to update work items.";
    }
  }
}

const bulkUpdateOpen = ref<boolean>(false);

function openBulkUpdate(): void {
  if (selectedItems.value.length === 0) return;
  bulkUpdateOpen.value = true;
}

async function onBulkUpdateApplied(): Promise<void> {
  await fetchPage();
  void reloadTasks();
}

// --- Connect to parent (task/segment) ---
const connectDialogOpen = ref<boolean>(false);
const connectTargetType = ref<"task" | "segment">("task");
const connectItems = ref<WorkItem[]>([]);

function openConnect(target: "task" | "segment", items: WorkItem[]): void {
  if (items.length === 0) return;
  connectTargetType.value = target;
  connectItems.value = items;
  connectDialogOpen.value = true;
}

async function onConnectApplied(payload: {
  parentId: string;
  updatedItems: WorkItem[];
}): Promise<void> {
  // Splice updated items into the local list for instant feedback.
  if (payload.updatedItems.length > 0) {
    const byId = new Map(payload.updatedItems.map((it) => [it._id, it]));
    items.value = items.value.map((it) => byId.get(it._id) ?? it);
  }
  // Clear any rows that are no longer relevant from the selection.
  if (selectedRows.value.size > 0) {
    const next = new Set<string>();
    for (const id of selectedRows.value) {
      if (items.value.some((it) => it._id === id)) next.add(id);
    }
    selectedRows.value = next;
  }
  // Ensure the new parent is expanded so the moved children stay visible —
  // backfillMissingParents (run inside fetchPage) will inject missing ancestors
  // and auto-expand them, but a parent that's already on the page won't be
  // touched there, so explicitly mark it expanded here.
  if (!expandedIds.value.has(payload.parentId)) {
    const next = new Set(expandedIds.value);
    next.add(payload.parentId);
    expandedIds.value = next;
  }
  // Refetch so the page reflects updatedAt / rank changes from the server.
  // fetchPage internally calls backfillMissingParents, which walks up the
  // ancestor chain for any item whose parent isn't on the current page.
  await fetchPage();
  void reloadTasks();
}

const canBulkConnectToTask = computed<boolean>(
  () =>
    selectedItems.value.length > 0 &&
    selectedItems.value.every((it) => it.type === "subtask"),
);

const canBulkConnectToSegment = computed<boolean>(
  () =>
    selectedItems.value.length > 0 &&
    selectedItems.value.every((it) => it.type === "task"),
);

const canBulkConnect = computed<boolean>(
  () => canBulkConnectToTask.value || canBulkConnectToSegment.value,
);

// Only tasks can be detached — subtasks require a parent task on the backend.
const canBulkDisconnectFromSegment = computed<boolean>(
  () =>
    selectedItems.value.length > 0 &&
    selectedItems.value.every(
      (it) => it.type === "task" && it.parentId !== null,
    ),
);

async function disconnectFromParent(targets: WorkItem[]): Promise<void> {
  const editable = targets.filter(
    (it) => canEditItem(it) && it.parentId !== null,
  );
  if (editable.length === 0) return;
  const label = editable.length === 1 ? `"${editable[0].title}"` : `${editable.length} tasks`;
  const ok = window.confirm(`Disconnect ${label} from its parent segment?`);
  if (!ok) return;
  loadError.value = null;
  try {
    const updated = await Promise.all(
      editable.map((it) =>
        workItemService.updateWorkItem(it._id, { parentId: null }),
      ),
    );
    const byId = new Map(updated.map((it) => [it._id, it]));
    items.value = items.value.map((it) => byId.get(it._id) ?? it);
    await fetchPage();
    void reloadTasks();
  } catch (err) {
    if (axios.isAxiosError(err)) {
      loadError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        "Failed to disconnect work items.";
    } else {
      loadError.value = "Failed to disconnect work items.";
    }
  }
}

async function bulkDelete(): Promise<void> {
  const ids = [...selectedRows.value];
  if (ids.length === 0) return;
  const ok = window.confirm(
    `Delete ${ids.length} work item${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
  );
  if (!ok) return;
  loadError.value = null;
  try {
    await Promise.all(ids.map((id) => workItemService.deleteWorkItem(id)));
    selectedRows.value = new Set();
    await fetchPage();
    void reloadTasks();
  } catch (err) {
    if (axios.isAxiosError(err)) {
      loadError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        "Failed to delete work items.";
    } else {
      loadError.value = "Failed to delete work items.";
    }
  }
}
</script>

<template>
  <div class="relative h-full">
    <DynamicDataTable
      v-model:page="page"
      v-model:limit="limit"
      v-model:sort-by="sortBy"
      v-model:sort-dir="sortDir"
      v-model:search="search"
      v-model:selected-rows="selectedRows"
      :items="flatRows"
      :total="total"
      :loading="loading"
      :error-message="tableError"
      :columns="columns"
      :get-row-id="getRowId"
      search-placeholder="Search work items…"
      empty-message="No work items yet."
      no-filters-empty-message="No items match the selected filters."
      @row-click="onRowClick"
    >
      <!-- Member avatars + entity-specific filters + Create button -->
      <template #toolbar-right>
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
      </template>

      <!-- More-menu (hide-done, hierarchy, exports) -->
      <template #more-menu>
        <div
          class="relative flex items-center justify-between gap-3 px-2 py-1.5 text-sm rounded-sm select-none cursor-pointer hover:bg-accent"
          @click="hideDone = !hideDone"
        >
          <span>
            {{ hideDone ? "Show done work items" : "Hide done work items" }}
          </span>
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
          <span>
            {{ showHierarchy ? "Hide hierarchy" : "Show hierarchy" }}
          </span>
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
      </template>

      <!-- Active filter chips -->
      <template #filter-chips>
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
      </template>

      <!-- Summary cell (with hierarchy tree) -->
      <template #cell-summary="{ row }">
        <div
          class="relative flex items-center h-13 pr-2"
          :class="
            canEditItem(row.item) && editingId !== row.item._id
              ? 'cursor-pointer'
              : ''
          "
          :style="{ paddingLeft: `${row.depth * 32}px` }"
          :title="
            canEditItem(row.item) && editingId !== row.item._id
              ? 'Double-click to rename'
              : undefined
          "
          @click="(e) => onTitleClick(e, row.item)"
          @dblclick="(e) => onTitleDblClick(e, row.item)"
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
            @dblclick.stop
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
              <template v-if="editingId === row.item._id">
                <input
                  :ref="setEditInputRef"
                  type="text"
                  class="w-full bg-background border border-primary/50 focus:border-primary rounded px-1.5 py-0.5 outline-none text-sm"
                  :disabled="editingSaving"
                  @keydown="(e) => onTitleKey(e, row.item)"
                  @blur="(e) => onTitleBlur(e, row.item)"
                  @click.stop
                  @dblclick.stop
                />
                <span
                  v-if="editingError"
                  class="text-[10px] text-destructive mt-0.5"
                >
                  {{ editingError }}
                </span>
              </template>
              <span v-else class="truncate">
                {{ row.item.title }}
              </span>
              <span
                class="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground"
              >
                <span class="font-mono text-muted-foreground">
                  {{ row.item.key }}
                </span>
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
      </template>

      <template #cell-type="{ row }">
        <span class="inline-flex items-center gap-1.5 text-xs">
          <VsxIcon
            :iconName="TYPE_META[row.item.type].icon"
            class="size-4 shrink-0"
            :class="TYPE_META[row.item.type].text"
          />
          {{ TYPE_META[row.item.type].label }}
        </span>
      </template>

      <template #cell-key="{ row }">
        <span class="font-mono text-xs text-muted-foreground">
          {{ row.item.key }}
        </span>
      </template>

      <template #cell-state="{ row }">
        <DropdownMenu v-if="canEditItem(row.item)">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="group/cell flex items-center justify-between gap-2 h-13 w-full px-4 cursor-pointer hover:bg-accent/40 transition-colors text-left"
              @click.stop
            >
              <span
                :class="[
                  'inline-block rounded px-2 py-0.5 text-xs',
                  STATE_BADGE[row.item.state],
                ]"
              >
                {{ STATE_LABELS[row.item.state] }}
              </span>
              <VsxIcon
                iconName="ArrowDown2"
                class="size-3 shrink-0 text-muted-foreground opacity-60 group-hover/cell:opacity-100 transition-opacity"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" @click.stop>
            <DropdownMenuItem
              v-for="s in EDITABLE_STATES"
              :key="s.value"
              @select="changeState(row.item, s.value)"
            >
              <span class="inline-flex items-center gap-2">
                <span :class="['size-2 rounded-full', STATE_DOT[s.value]]" />
                {{ s.label }}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div v-else class="flex items-center h-13 px-4">
          <span
            :class="[
              'inline-block rounded px-2 py-0.5 text-xs',
              STATE_BADGE[row.item.state],
            ]"
          >
            {{ STATE_LABELS[row.item.state] }}
          </span>
        </div>
      </template>

      <template #cell-priority="{ row }">
        <DropdownMenu v-if="canEditItem(row.item)">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="group/cell flex items-center justify-between gap-2 h-13 w-full px-4 cursor-pointer hover:bg-accent/40 transition-colors text-left"
              @click.stop
            >
              <span
                :class="[
                  'inline-block rounded px-2 py-0.5 text-xs capitalize',
                  PRIORITY_BADGE[row.item.priority],
                ]"
              >
                {{ row.item.priority }}
              </span>
              <VsxIcon
                iconName="ArrowDown2"
                class="size-3 shrink-0 text-muted-foreground opacity-60 group-hover/cell:opacity-100 transition-opacity"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" @click.stop>
            <DropdownMenuItem
              v-for="p in EDITABLE_PRIORITIES"
              :key="p.value"
              @select="changePriority(row.item, p.value)"
            >
              <span
                :class="[
                  'inline-block size-2 rounded-full',
                  p.value === 'urgent'
                    ? 'bg-red-500'
                    : p.value === 'high'
                      ? 'bg-amber-500'
                      : p.value === 'medium'
                        ? 'bg-blue-500'
                        : 'bg-slate-400',
                ]"
              />
              <span>{{ p.label }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div v-else class="flex items-center h-13 px-4">
          <span
            :class="[
              'inline-block rounded px-2 py-0.5 text-xs capitalize',
              PRIORITY_BADGE[row.item.priority],
            ]"
          >
            {{ row.item.priority }}
          </span>
        </div>
      </template>

      <template #cell-assignee="{ row }">
        <DropdownMenu v-if="canEditItem(row.item)">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="group/cell flex items-center justify-between gap-2 h-13 w-full px-4 cursor-pointer hover:bg-accent/40 transition-colors text-left"
              @click.stop
            >
              <span class="flex items-center gap-2 min-w-0">
                <template v-if="row.item.assigneeId">
                  <Avatar class="size-6 shrink-0">
                    <AvatarFallback class="text-[10px]">
                      {{ memberInitials(row.item.assigneeId) }}
                    </AvatarFallback>
                  </Avatar>
                  <span class="text-xs truncate">
                    {{ memberName(row.item.assigneeId) }}
                  </span>
                </template>
                <span v-else class="text-xs text-muted-foreground">
                  Unassigned
                </span>
              </span>
              <VsxIcon
                iconName="ArrowDown2"
                class="size-3 shrink-0 text-muted-foreground opacity-60 group-hover/cell:opacity-100 transition-opacity"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            class="max-h-72 overflow-y-auto"
            @click.stop
          >
            <DropdownMenuItem @select="changeAssignee(row.item, null)">
              <VsxIcon iconName="User" class="size-4" />
              <span>Unassigned</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              v-for="u in projectMemberUsers"
              :key="u._id"
              @select="changeAssignee(row.item, u._id)"
            >
              <Avatar class="size-5">
                <AvatarFallback class="text-[9px]">
                  {{ userStore.initials(u._id) }}
                </AvatarFallback>
              </Avatar>
              <span>{{ u.name }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div v-else class="flex items-center h-13 px-4">
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
          <span v-else class="text-xs text-muted-foreground">Unassigned</span>
        </div>
      </template>

      <template #cell-reporter="{ row }">
        <DropdownMenu v-if="canEditItem(row.item)">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="group/cell flex items-center justify-between gap-2 h-13 w-full px-4 cursor-pointer hover:bg-accent/40 transition-colors text-left"
              @click.stop
            >
              <span class="flex items-center gap-2 min-w-0">
                <template v-if="row.item.reporterId">
                  <Avatar class="size-6 shrink-0">
                    <AvatarFallback class="text-[10px]">
                      {{ memberInitials(row.item.reporterId) }}
                    </AvatarFallback>
                  </Avatar>
                  <span class="text-xs truncate">
                    {{ memberName(row.item.reporterId) }}
                  </span>
                </template>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </span>
              <VsxIcon
                iconName="ArrowDown2"
                class="size-3 shrink-0 text-muted-foreground opacity-60 group-hover/cell:opacity-100 transition-opacity"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            class="max-h-72 overflow-y-auto"
            @click.stop
          >
            <DropdownMenuItem
              v-for="u in projectMemberUsers"
              :key="u._id"
              @select="changeReporter(row.item, u._id)"
            >
              <Avatar class="size-5">
                <AvatarFallback class="text-[9px]">
                  {{ userStore.initials(u._id) }}
                </AvatarFallback>
              </Avatar>
              <span>{{ u.name }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div v-else class="flex items-center h-13 px-4">
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
        </div>
      </template>

      <template #cell-labels="{ row }">
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
      </template>

      <template #cell-components="{ row }">
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
      </template>

      <template #cell-sprint="{ row }">
        <span v-if="row.item.sprintId" class="text-xs truncate">
          {{ sprintName(row.item.sprintId) }}
        </span>
        <span v-else class="text-xs text-muted-foreground">—</span>
      </template>

      <template #cell-storyPoints="{ row }">
        <span
          v-if="row.item.storyPoints != null"
          class="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs"
        >
          {{ row.item.storyPoints }}
        </span>
        <span v-else class="text-xs text-muted-foreground">—</span>
      </template>

      <template #cell-dueDate="{ row }">
        <DropdownMenu v-if="canEditItem(row.item)">
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="group/cell flex items-center justify-between gap-2 h-13 w-full px-4 cursor-pointer hover:bg-accent/40 transition-colors text-left"
              @click.stop
            >
              <span class="text-xs text-muted-foreground">
                {{ row.item.dueDate ? formatDate(row.item.dueDate) : "—" }}
              </span>
              <VsxIcon
                iconName="ArrowDown2"
                class="size-3 shrink-0 text-muted-foreground opacity-60 group-hover/cell:opacity-100 transition-opacity"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            class="p-2 flex flex-col gap-2 min-w-52"
            @click.stop
          >
            <input
              type="date"
              :value="dateOnly(row.item.dueDate)"
              class="border rounded px-2 py-1 text-sm bg-background"
              @change="(e) => changeDueDate(row.item, e)"
            />
            <button
              v-if="row.item.dueDate"
              type="button"
              class="cursor-pointer text-xs text-muted-foreground hover:text-destructive text-left px-2 py-1"
              @click="changeDueDate(row.item, null)"
            >
              Clear due date
            </button>
          </DropdownMenuContent>
        </DropdownMenu>
        <div v-else class="flex items-center h-13 px-4">
          <span class="text-xs text-muted-foreground">
            {{ row.item.dueDate ? formatDate(row.item.dueDate) : "—" }}
          </span>
        </div>
      </template>

      <template #cell-attachments="{ row }">
        <span
          v-if="row.item.attachments.length"
          class="inline-flex items-center gap-1 text-xs"
        >
          <VsxIcon iconName="Paperclip2" class="size-3.5" />
          {{ row.item.attachments.length }}
        </span>
        <span v-else class="text-xs text-muted-foreground">—</span>
      </template>

      <template #cell-updated="{ row }">
        <span class="text-xs text-muted-foreground">
          {{ formatDateTime(row.item.updatedAt) }}
        </span>
      </template>

      <template #cell-created="{ row }">
        <span class="text-xs text-muted-foreground">
          {{ formatDateTime(row.item.createdAt) }}
        </span>
      </template>

      <template #cell-createdBy="{ row }">
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
      </template>

      <!-- Row actions -->
      <template #row-actions="{ row }">
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
          v-if="row.item.type === 'subtask'"
          :disabled="!canEditItem(row.item)"
          @select="openConnect('task', [row.item])"
        >
          <VsxIcon iconName="TaskSquare" class="size-4 text-sky-600" />
          <span>
            {{
              row.item.parentId ? "Switch Connected Task" : "Connect to Task"
            }}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="row.item.type === 'task'"
          :disabled="!canEditItem(row.item)"
          @select="openConnect('segment', [row.item])"
        >
          <VsxIcon iconName="Element4" class="size-4 text-violet-600" />
          <span>
            {{
              row.item.parentId
                ? "Switch Connected Segment"
                : "Connect to Segment"
            }}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="row.item.type === 'task' && row.item.parentId"
          :disabled="!canEditItem(row.item)"
          @select="disconnectFromParent([row.item])"
        >
          <VsxIcon iconName="Link21" class="size-4 text-amber-600" />
          <span>Disconnect from Segment</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator
          v-if="row.item.type === 'subtask' || row.item.type === 'task'"
        />
        <DropdownMenuItem variant="destructive" @select="deleteRow(row.item)">
          <VsxIcon iconName="Trash" class="size-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </template>
    </DynamicDataTable>

    <!-- Floating bulk-selection action bar (centered within content area) -->
    <Transition
      enter-active-class="transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-[cubic-bezier(0.7,0,0.84,0)]"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-3"
    >
      <div
        v-if="selectedCount > 0"
        class="absolute bottom-2 left-0 right-0 mx-auto w-fit z-50 flex flex-nowrap whitespace-nowrap items-center gap-0.5 rounded-xl bg-card/15 backdrop-blur-xl text-foreground px-2 py-1.5 shadow-2xl shadow-black/15 border-2 border-border"
      >
        <span class="flex items-center gap-2 px-3 text-sm">
          <span
            class="inline-flex items-center justify-center min-w-6 h-6 rounded bg-muted px-1.5 text-xs font-medium"
          >
            {{ selectedCount }}
          </span>
          <span class="text-muted-foreground">Selected</span>
        </span>

        <span class="w-px h-6 bg-border mx-1" />

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm cursor-pointer hover:bg-accent transition-colors"
          @click="selectAllRows"
        >
          <VsxIcon iconName="TickSquare" class="size-4" />
          <span>Select all</span>
        </button>

        <span class="w-px h-6 bg-border mx-1" />

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm cursor-pointer hover:bg-accent transition-colors"
          @click="clearSelection"
        >
          <VsxIcon iconName="CloseSquare" class="size-4" />
          <span>Unselect All</span>
        </button>

        <span class="w-px h-6 bg-border mx-1" />

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm cursor-pointer hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canBulkEdit"
          @click="openBulkUpdate"
        >
          <VsxIcon iconName="Edit" class="size-4" />
          <span>Update Fields</span>
        </button>

        <span class="w-px h-6 bg-border mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm cursor-pointer hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canBulkEdit"
            >
              <VsxIcon iconName="ArrowSwapHorizontal" class="size-4" />
              <span>Change Status</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuItem
              v-for="s in EDITABLE_STATES"
              :key="s.value"
              @select="bulkChangeStatus(s.value)"
            >
              <span class="inline-flex items-center gap-2">
                <span :class="['size-2 rounded-full', STATE_DOT[s.value]]" />
                {{ s.label }}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span class="w-px h-6 bg-border mx-1" />

        <template v-if="canBulkConnect">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm cursor-pointer hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!canBulkEdit"
              >
                <VsxIcon iconName="Link" class="size-4" />
                <span>Connect</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top">
              <DropdownMenuItem
                v-if="canBulkConnectToTask"
                @select="openConnect('task', selectedItems)"
              >
                <VsxIcon iconName="TaskSquare" class="size-4 text-sky-600" />
                <span>Connect / Switch to Task</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canBulkConnectToSegment"
                @select="openConnect('segment', selectedItems)"
              >
                <VsxIcon iconName="Element4" class="size-4 text-violet-600" />
                <span>Connect / Switch to Segment</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canBulkDisconnectFromSegment"
                @select="disconnectFromParent(selectedItems)"
              >
                <VsxIcon iconName="Link21" class="size-4 text-amber-600" />
                <span>Disconnect from Segment</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span class="w-px h-6 bg-border mx-1" />
        </template>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm text-destructive cursor-pointer hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canBulkEdit"
          @click="bulkDelete"
        >
          <VsxIcon iconName="Trash" class="size-4" />
          <span>Delete</span>
        </button>

        <span class="w-px h-6 bg-border mx-1" />

        <button
          type="button"
          class="inline-flex items-center justify-center size-9 rounded-md text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Close"
          @click="clearSelection"
        >
          <VsxIcon iconName="CloseCircle" class="size-4" />
        </button>
      </div>
    </Transition>

    <BulkUpdateFieldsDialog
      v-if="project"
      v-model:open="bulkUpdateOpen"
      :items="selectedItems"
      :project="project"
      @applied="onBulkUpdateApplied"
    />

    <ConnectParentDialog
      v-if="project"
      v-model:open="connectDialogOpen"
      :items="connectItems"
      :project="project"
      :target-type="connectTargetType"
      @applied="onConnectApplied"
    />
  </div>
</template>
