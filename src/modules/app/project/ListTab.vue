<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { VsxIcon } from "vue-iconsax";
import { useWorkItemStore } from "@/store/workItem";
import { useComponentStore } from "@/store/component";
import type {
  ProjectComponent,
  WorkItem,
  WorkItemPriority,
  WorkItemState,
  WorkItemType,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useProjectContext } from "./projectContext";

const router = useRouter();
const workItemStore = useWorkItemStore();
const componentStore = useComponentStore();
const { items } = storeToRefs(workItemStore);
const { tasksLoading, tasksError, canCreateTask, openCreateTask } =
  useProjectContext();

const STATE_OPTIONS: { value: WorkItemState | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "DONE", label: "Done" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "CANCELLED", label: "Cancelled" },
];

const TYPE_OPTIONS: { value: WorkItemType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "segment", label: "Segments" },
  { value: "task", label: "Tasks" },
  { value: "subtask", label: "Subtasks" },
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

const stateFilter = ref<WorkItemState | "ALL">("ALL");
const typeFilter = ref<WorkItemType | "ALL">("ALL");

const expandedIds = ref<Set<string>>(new Set());

interface FlatRow {
  item: WorkItem;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  isLastChild: boolean;
  // For each ancestor depth (0 .. depth-1), true means that ancestor has more
  // siblings below, so its spine should continue through this row.
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
    // Orphans (parent not in list) bubble up to root so they're still reachable.
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

function passesFilters(it: WorkItem): boolean {
  if (stateFilter.value !== "ALL" && it.state !== stateFilter.value)
    return false;
  if (typeFilter.value !== "ALL" && it.type !== typeFilter.value) return false;
  return true;
}

// Items that pass filters, plus all their ancestors so the tree path stays reachable.
const visibleIds = computed<Set<string>>(() => {
  const set = new Set<string>();
  for (const it of items.value) {
    if (!passesFilters(it)) continue;
    set.add(it._id);
    let parent = it.parentId ? itemById.value.get(it.parentId) : undefined;
    while (parent && !set.has(parent._id)) {
      set.add(parent._id);
      parent = parent.parentId
        ? itemById.value.get(parent.parentId)
        : undefined;
    }
  }
  return set;
});

function visibleChildren(parentId: string | null): WorkItem[] {
  return (childrenByParent.value.get(parentId) ?? []).filter((c) =>
    visibleIds.value.has(c._id),
  );
}

const flatRows = computed<FlatRow[]>(() => {
  const out: FlatRow[] = [];
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

function memberInitials(id: string | null): string {
  if (!id) return "?";
  return id.slice(-2).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
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
      v-else-if="flatRows.length === 0"
      class="rounded-lg border border-dashed p-12 text-center"
    >
      <p class="text-sm text-muted-foreground">
        {{
          items.length === 0
            ? "No work items yet."
            : "No items match the selected filters."
        }}
      </p>
    </div>

    <div v-else class="rounded-lg border bg-card overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-muted/40 text-muted-foreground">
          <tr>
            <!-- <th class="p-0"></th> -->
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
            v-for="row in flatRows"
            :key="row.item._id"
            class="border-t cursor-pointer hover:bg-accent/40 h-13"
            @click="openItem(row.item._id)"
          >
            <td class="p-0 align-middle h-13 max-w-56">
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
                    (row.hasChildren && 'ml-3') || (row.item.parentId && 'ml-2')
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

            <td class="px-4 py-2.5">
              <span
                :class="[
                  'inline-block rounded px-2 py-0.5 text-xs',
                  STATE_BADGE[row.item.state],
                ]"
              >
                {{ STATE_LABELS[row.item.state] }}
              </span>
            </td>
            <td class="px-4 py-2.5">
              <span
                :class="[
                  'inline-block rounded px-2 py-0.5 text-xs capitalize',
                  PRIORITY_BADGE[row.item.priority],
                ]"
              >
                {{ row.item.priority }}
              </span>
            </td>
            <td class="px-4 py-2.5">
              <div v-if="row.item.assigneeId" class="flex items-center gap-2">
                <Avatar class="size-6">
                  <AvatarFallback class="text-[10px]">
                    {{ memberInitials(row.item.assigneeId) }}
                  </AvatarFallback>
                </Avatar>
                <span class="font-mono text-xs text-muted-foreground">
                  @{{ row.item.assigneeId.slice(-6) }}
                </span>
              </div>
              <span v-else class="text-xs text-muted-foreground">
                Unassigned
              </span>
            </td>
            <td
              class="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground"
            >
              {{ formatDate(row.item.updatedAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
