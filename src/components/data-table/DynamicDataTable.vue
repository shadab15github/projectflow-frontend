<script setup lang="ts" generic="T">
import { computed, onUnmounted, ref, useSlots, watch } from "vue";
import { VsxIcon } from "vue-iconsax";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "./types";

interface Props {
  items: T[];
  total: number;
  loading?: boolean;
  errorMessage?: string | null;
  columns: ColumnDef[];
  getRowId: (row: T) => string;

  // v-model'd state — parent owns it.
  page?: number;
  limit?: number;
  sortBy?: string | null;
  sortDir?: "asc" | "desc";
  search?: string;
  selectedRows?: Set<string>;

  // Feature toggles
  enableSelection?: boolean;
  enableColumnSettings?: boolean;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  rowClickable?: boolean;
  pageSizes?: number[];
  emptyMessage?: string;
  noFiltersEmptyMessage?: string;
  /** Debounce delay (ms) for the search input → `update:search`. */
  searchDebounceMs?: number;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  errorMessage: null,
  page: 1,
  limit: 25,
  sortBy: null,
  sortDir: "desc",
  search: "",
  selectedRows: () => new Set<string>(),
  enableSelection: true,
  enableColumnSettings: true,
  enableSearch: true,
  searchPlaceholder: "Search…",
  rowClickable: true,
  pageSizes: () => [10, 25, 50, 100],
  emptyMessage: "No items yet.",
  noFiltersEmptyMessage: "No items match the selected filters.",
  searchDebounceMs: 300,
});

const emit = defineEmits<{
  "update:page": [value: number];
  "update:limit": [value: number];
  "update:sortBy": [value: string | null];
  "update:sortDir": [value: "asc" | "desc"];
  "update:search": [value: string];
  "update:selectedRows": [value: Set<string>];
  "row-click": [row: T];
}>();

const slots = useSlots();

// Reserved keys for internally-managed columns. User columns must not collide.
const SELECT_KEY = "__select";
const ACTIONS_KEY = "__actions";
const SELECT_WIDTH = 52;
const ACTIONS_WIDTH = 64;

type InternalColumn = ColumnDef & {
  isBuiltin?: boolean;
  fixed?: "left" | "right";
};

// --- Column state (table-managed; not v-model'd) ---
const visibleColumns = ref<Record<string, boolean>>({});
const columnWidths = ref<Record<string, number>>({});
const frozenColumns = ref<Set<string>>(new Set());

function defaultsForColumn(c: ColumnDef): { visible: boolean; width: number } {
  return {
    visible: c.defaultVisible !== false,
    width: c.defaultWidth ?? 160,
  };
}

function initState(): void {
  const vis: Record<string, boolean> = {};
  const wid: Record<string, number> = {};
  const frozen = new Set<string>();
  for (const c of props.columns) {
    const d = defaultsForColumn(c);
    vis[c.key] = d.visible;
    wid[c.key] = d.width;
    if (c.freezable && c.defaultFrozen) frozen.add(c.key);
  }
  visibleColumns.value = vis;
  columnWidths.value = wid;
  frozenColumns.value = frozen;
}

// Preserve user choices across columns prop changes (e.g., dynamic columns).
function reconcileState(): void {
  const vis: Record<string, boolean> = {};
  const wid: Record<string, number> = {};
  for (const c of props.columns) {
    const d = defaultsForColumn(c);
    vis[c.key] =
      c.key in visibleColumns.value ? visibleColumns.value[c.key] : d.visible;
    wid[c.key] =
      c.key in columnWidths.value ? columnWidths.value[c.key] : d.width;
  }
  visibleColumns.value = vis;
  columnWidths.value = wid;
}

initState();

watch(
  () => props.columns.map((c) => c.key).join("|"),
  () => reconcileState(),
);

// --- Built-in / internal column composition ---
const hasActionsSlot = computed(() => Boolean(slots["row-actions"]));
const hasMoreMenuSlot = computed(() => Boolean(slots["more-menu"]));
const hasToolbarLeftSlot = computed(() => Boolean(slots["toolbar-left"]));
const hasToolbarRightSlot = computed(() => Boolean(slots["toolbar-right"]));

const showToolbar = computed(
  () =>
    props.enableSearch ||
    hasToolbarLeftSlot.value ||
    hasToolbarRightSlot.value ||
    props.enableColumnSettings ||
    hasMoreMenuSlot.value,
);

const internalColumns = computed<InternalColumn[]>(() => {
  const out: InternalColumn[] = [];
  if (props.enableSelection) {
    out.push({
      key: SELECT_KEY,
      label: "",
      defaultWidth: SELECT_WIDTH,
      minWidth: SELECT_WIDTH,
      fixed: "left",
      alwaysVisible: true,
      isBuiltin: true,
    });
  }
  for (const c of props.columns) out.push(c);
  if (hasActionsSlot.value) {
    out.push({
      key: ACTIONS_KEY,
      label: "",
      defaultWidth: ACTIONS_WIDTH,
      minWidth: ACTIONS_WIDTH,
      fixed: "right",
      alwaysVisible: true,
      isBuiltin: true,
    });
  }
  return out;
});

const activeColumns = computed<InternalColumn[]>(() =>
  internalColumns.value.filter(
    (c) => c.isBuiltin || visibleColumns.value[c.key] !== false,
  ),
);

// Rightmost non-fixed-right column auto-stretches to fill leftover width.
const stretchKey = computed<string | null>(() => {
  for (let i = activeColumns.value.length - 1; i >= 0; i--) {
    const c = activeColumns.value[i];
    if (c.fixed !== "right") return c.key;
  }
  return null;
});

function colWidth(key: string): number {
  const def = internalColumns.value.find((c) => c.key === key);
  if (!def) return 160;
  if (def.isBuiltin) return def.defaultWidth ?? 100;
  return columnWidths.value[key] ?? def.defaultWidth ?? 160;
}

const tableMinWidth = computed<number>(() => {
  let total = 0;
  for (const c of activeColumns.value) {
    if (c.key === stretchKey.value) total += c.minWidth ?? 100;
    else total += colWidth(c.key);
  }
  return total;
});

// --- Column visibility / reset ---
const togglableColumns = computed(() =>
  props.columns.filter((c) => c.label && !c.alwaysVisible),
);

function toggleColumn(key: string): void {
  const def = internalColumns.value.find((c) => c.key === key);
  if (!def || def.alwaysVisible) return;
  visibleColumns.value = {
    ...visibleColumns.value,
    [key]: !visibleColumns.value[key],
  };
}

function resetColumns(): void {
  initState();
}

// --- Freeze (user-pinned sticky-left column) ---
function isFrozen(key: string): boolean {
  return frozenColumns.value.has(key);
}

function toggleFreeze(key: string): void {
  const def = internalColumns.value.find((c) => c.key === key);
  if (!def || !def.freezable) return;
  // Only one user-frozen column at a time keeps the layout sane.
  const next = new Set<string>();
  if (!frozenColumns.value.has(key)) next.add(key);
  frozenColumns.value = next;
}

function isStickyLeft(c: InternalColumn): boolean {
  return c.fixed === "left" || isFrozen(c.key);
}

// Cumulative left offset for a sticky-left column, summing the widths of all
// sticky-left columns that appear before it in `activeColumns`.
function frozenLeftOffset(key: string): number {
  let offset = 0;
  for (const c of activeColumns.value) {
    if (c.key === key) return offset;
    if (isStickyLeft(c)) offset += colWidth(c.key);
  }
  return offset;
}

// --- Sort ---
function setSort(field: string): void {
  if (props.sortBy === field) {
    emit("update:sortDir", props.sortDir === "asc" ? "desc" : "asc");
  } else {
    emit("update:sortBy", field);
    emit("update:sortDir", "asc");
  }
}

// --- Pagination ---
const totalPages = computed(() =>
  props.total === 0 ? 1 : Math.ceil(props.total / props.limit),
);

const pageNumbers = computed<number[]>(() => {
  const tp = totalPages.value;
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1);
  const cur = props.page;
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
  props.total === 0 ? 0 : (props.page - 1) * props.limit + 1,
);
const showingTo = computed(() =>
  Math.min(props.page * props.limit, props.total),
);

function gotoPage(p: number): void {
  if (p < 1 || p > totalPages.value) return;
  emit("update:page", p);
}

function setLimit(n: number): void {
  emit("update:limit", n);
  emit("update:page", 1);
}

// --- Search (built-in debounce) ---
const searchInput = ref(props.search);

watch(
  () => props.search,
  (v) => {
    if (v !== searchInput.value) searchInput.value = v;
  },
);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(searchInput, (v) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const trimmed = v.trim();
    if (trimmed !== props.search) {
      emit("update:search", trimmed);
      emit("update:page", 1);
    }
  }, props.searchDebounceMs);
});

// --- Selection ---
function isRowSelected(id: string): boolean {
  return props.selectedRows.has(id);
}

function toggleRow(id: string, value: boolean | "indeterminate"): void {
  const next = new Set(props.selectedRows);
  if (value === true) next.add(id);
  else next.delete(id);
  emit("update:selectedRows", next);
}

const pageSelectionState = computed<boolean | "indeterminate">(() => {
  if (props.items.length === 0) return false;
  let selected = 0;
  for (const it of props.items) {
    if (props.selectedRows.has(props.getRowId(it))) selected++;
  }
  if (selected === 0) return false;
  if (selected === props.items.length) return true;
  return "indeterminate";
});

function togglePageSelection(value: boolean | "indeterminate"): void {
  const next = new Set(props.selectedRows);
  if (value === true) {
    for (const it of props.items) next.add(props.getRowId(it));
  } else {
    for (const it of props.items) next.delete(props.getRowId(it));
  }
  emit("update:selectedRows", next);
}

// --- Resize (drag handle on the right of <th>) ---
const resizing = ref<string | null>(null);
let resizeStartX = 0;
let resizeStartWidth = 0;

function startResize(e: MouseEvent, key: string): void {
  const def = internalColumns.value.find((c) => c.key === key);
  if (!def || def.isBuiltin) return;
  e.preventDefault();
  e.stopPropagation();
  resizing.value = key;
  resizeStartX = e.clientX;
  resizeStartWidth = colWidth(key);
  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", endResize);
}

function onResizeMove(e: MouseEvent): void {
  const key = resizing.value;
  if (!key) return;
  const def = internalColumns.value.find((c) => c.key === key);
  if (!def) return;
  const minW = def.minWidth ?? 80;
  const next = Math.max(minW, resizeStartWidth + (e.clientX - resizeStartX));
  columnWidths.value = { ...columnWidths.value, [key]: next };
}

function endResize(): void {
  resizing.value = null;
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", endResize);
}

function nudgeWidth(key: string): void {
  const def = internalColumns.value.find((c) => c.key === key);
  if (!def || def.isBuiltin) return;
  columnWidths.value = {
    ...columnWidths.value,
    [key]: colWidth(key) + 40,
  };
}

onUnmounted(() => {
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", endResize);
});

// --- Cell value fallback (for when no `cell-<key>` slot is provided) ---
function defaultCellValue(row: T, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

function cellAlignClass(c: InternalColumn): string {
  if (c.align === "center") return "text-center";
  if (c.align === "right") return "text-right";
  return "";
}

function onRowClick(row: T): void {
  if (!props.rowClickable) return;
  emit("row-click", row);
}
</script>

<template>
  <div class="flex flex-col gap-3 h-full">
    <!-- Toolbar -->
    <div
      v-if="showToolbar"
      class="shrink-0 flex flex-wrap items-center justify-between gap-2"
    >
      <div class="flex items-center gap-2 flex-1 min-w-64">
        <div v-if="enableSearch" class="relative flex-1 max-w-sm">
          <VsxIcon
            iconName="SearchNormal1"
            class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="searchInput"
            type="search"
            :placeholder="searchPlaceholder"
            class="pl-8 h-9"
          />
        </div>
        <slot name="toolbar-left" />
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <slot name="toolbar-right" />

        <!-- Column visibility -->
        <DropdownMenu v-if="enableColumnSettings && togglableColumns.length">
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
              v-for="col in togglableColumns"
              :key="`col-${col.key}`"
              class="relative flex items-center justify-between gap-3 px-2 py-1.5 text-sm rounded-sm select-none cursor-pointer hover:bg-accent"
              @click="toggleColumn(col.key)"
            >
              <span>{{ col.label }}</span>
              <Switch
                tabindex="-1"
                :model-value="visibleColumns[col.key]"
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

        <DropdownMenu v-if="hasMoreMenuSlot">
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="icon-sm" aria-label="More actions">
              <VsxIcon iconName="More" class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            class="min-w-60 max-h-96 overflow-y-auto"
          >
            <slot name="more-menu" />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <!-- Filter chips (consumer-supplied; consumer owns the wrapper + v-if so an
         empty chip row doesn't take up gap space). -->
    <slot name="filter-chips" />

    <p v-if="errorMessage" class="text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <p
      v-if="loading && items.length === 0"
      class="text-sm text-muted-foreground"
    >
      Loading…
    </p>

    <div
      v-else-if="items.length === 0"
      class="rounded-lg border border-dashed p-12 text-center"
    >
      <slot name="empty">
        <p class="text-sm text-muted-foreground">
          {{ total === 0 ? emptyMessage : noFiltersEmptyMessage }}
        </p>
      </slot>
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
                col.fixed === 'right'
                  ? 'right-0 z-20 [box-shadow:-1px_0_0_var(--border),0_1px_0_var(--border)]'
                  : '[box-shadow:0_1px_0_var(--border)]',
                isStickyLeft(col) ? 'z-20' : '',
              ]"
              :style="
                isStickyLeft(col)
                  ? { left: `${frozenLeftOffset(col.key)}px` }
                  : undefined
              "
            >
              <!-- Built-in select header -->
              <div
                v-if="col.key === SELECT_KEY"
                class="flex items-center justify-center"
                @click.stop
              >
                <Checkbox
                  :model-value="pageSelectionState"
                  aria-label="Select all rows on this page"
                  @update:model-value="togglePageSelection"
                />
              </div>

              <!-- Built-in actions header: blank -->
              <div v-else-if="col.key === ACTIONS_KEY" class="sr-only">
                Actions
              </div>

              <!-- Standard header -->
              <div v-else class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1">
                  <slot :name="`header-${col.key}`">{{ col.label }}</slot>
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
                    <DropdownMenuItem
                      v-if="col.freezable"
                      @select="toggleFreeze(col.key)"
                    >
                      <VsxIcon
                        iconName="Lock1"
                        class="size-4"
                        :class="isFrozen(col.key) ? 'text-primary' : ''"
                      />
                      <span>
                        {{
                          isFrozen(col.key)
                            ? "Unfreeze column"
                            : "Freeze column"
                        }}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem @select="nudgeWidth(col.key)">
                      <VsxIcon iconName="Maximize" class="size-4" />
                      <span>Resize column (+40px)</span>
                    </DropdownMenuItem>
                    <template v-if="!col.alwaysVisible">
                      <DropdownMenuSeparator />
                      <DropdownMenuItem @select="toggleColumn(col.key)">
                        <VsxIcon iconName="EyeSlash" class="size-4" />
                        <span>Hide column</span>
                      </DropdownMenuItem>
                    </template>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <!-- Drag handle for resize -->
              <span
                v-if="!col.isBuiltin && col.key !== stretchKey"
                class="absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none hover:bg-primary/40"
                :class="resizing === col.key ? 'bg-primary/60' : ''"
                @mousedown="startResize($event, col.key)"
              />
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="row in items"
            :key="getRowId(row)"
            class="h-13 [&>td]:border-t"
            :class="[
              rowClickable ? 'cursor-pointer' : '',
              isRowSelected(getRowId(row))
                ? 'bg-primary/5 hover:bg-primary/10'
                : rowClickable
                  ? 'hover:bg-accent/40'
                  : '',
            ]"
            @click="onRowClick(row)"
          >
            <template
              v-for="col in activeColumns"
              :key="`td-${col.key}-${getRowId(row)}`"
            >
              <!-- Built-in select cell -->
              <td
                v-if="col.key === SELECT_KEY"
                class="p-0 align-middle h-13 border-r last:border-r-0 text-center sticky left-0 z-10"
                :class="
                  isRowSelected(getRowId(row)) ? 'bg-primary/5' : 'bg-card'
                "
                @click.stop
              >
                <div class="flex items-center justify-center">
                  <Checkbox
                    :model-value="isRowSelected(getRowId(row))"
                    @update:model-value="toggleRow(getRowId(row), $event)"
                  />
                </div>
              </td>

              <!-- Built-in actions cell -->
              <td
                v-else-if="col.key === ACTIONS_KEY"
                class="px-2 py-2.5 border-r last:border-r-0 text-center sticky right-0 z-10 [box-shadow:-1px_0_0_var(--border)]"
                :class="
                  isRowSelected(getRowId(row)) ? 'bg-primary/5' : 'bg-card'
                "
                @click.stop
              >
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center size-7 rounded hover:bg-accent text-muted-foreground"
                      aria-label="Row actions"
                    >
                      <VsxIcon iconName="More" class="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    class="min-w-52 max-h-96 overflow-y-auto"
                  >
                    <slot name="row-actions" :row="row" />
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>

              <!-- Data cell -->
              <td
                v-else
                class="px-4 py-2.5 border-r last:border-r-0 align-middle"
                :class="[
                  cellAlignClass(col),
                  col.whitespaceNowrap ? 'whitespace-nowrap' : '',
                  col.cellClass ?? '',
                  isFrozen(col.key)
                    ? isRowSelected(getRowId(row))
                      ? 'sticky z-10 bg-primary/5'
                      : 'sticky z-10 bg-card'
                    : '',
                ]"
                :style="
                  isFrozen(col.key)
                    ? { left: `${frozenLeftOffset(col.key)}px` }
                    : undefined
                "
              >
                <slot
                  :name="`cell-${col.key}`"
                  :row="row"
                  :value="defaultCellValue(row, col.key)"
                >
                  {{ defaultCellValue(row, col.key) ?? "—" }}
                </slot>
              </td>
            </template>
          </tr>

          <!-- Filler row: stretches to fill vertical space so column borders
               extend to the bottom of the table. -->
          <tr aria-hidden="true" class="h-full pointer-events-none">
            <td
              v-for="col in activeColumns"
              :key="`filler-${col.key}`"
              class="border-t border-r last:border-r-0 bg-card"
              :class="[
                isStickyLeft(col) ? 'sticky z-10' : '',
                col.fixed === 'right'
                  ? 'sticky right-0 z-10 [box-shadow:-1px_0_0_var(--border)]'
                  : '',
              ]"
              :style="
                isStickyLeft(col)
                  ? { left: `${frozenLeftOffset(col.key)}px` }
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
            :value="limit"
            class="h-8 rounded border bg-background px-1.5 text-xs"
            @change="
              setLimit(Number(($event.target as HTMLSelectElement).value))
            "
          >
            <option v-for="size in pageSizes" :key="size" :value="size">
              {{ size }}
            </option>
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
