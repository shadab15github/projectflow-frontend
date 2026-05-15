<script setup lang="ts">
import { computed, ref, watch } from "vue";
import axios from "axios";
import { VsxIcon } from "vue-iconsax";
import * as workItemService from "@/services/workItem.service";
import type { Project, WorkItem } from "@/types";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  items: WorkItem[];
  project: Project;
  targetType: "task" | "segment";
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  applied: [payload: { parentId: string; updatedItems: WorkItem[] }];
}>();

const TYPE_META = {
  segment: {
    label: "Segment",
    icon: "Element4",
    text: "text-violet-600",
    bg: "bg-violet-100",
  },
  task: {
    label: "Task",
    icon: "TaskSquare",
    text: "text-sky-600",
    bg: "bg-sky-100",
  },
  subtask: {
    label: "Subtask",
    icon: "TickSquare",
    text: "text-emerald-600",
    bg: "bg-emerald-100",
  },
} as const;

const candidates = ref<WorkItem[]>([]);
const loading = ref(false);
const errorMsg = ref<string | null>(null);
const search = ref("");
const submittingId = ref<string | null>(null);

const itemCount = computed(() => props.items.length);
const targetMeta = computed(() => TYPE_META[props.targetType]);

const selectedIds = computed(() => new Set(props.items.map((it) => it._id)));

const filtered = computed<WorkItem[]>(() => {
  const q = search.value.trim().toLowerCase();
  return candidates.value
    .filter((c) => !selectedIds.value.has(c._id))
    .filter((c) => {
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q)
      );
    });
});

const VISIBLE_CHIPS = 4;
const visibleSelected = computed(() => props.items.slice(0, VISIBLE_CHIPS));
const hiddenSelectedCount = computed(() =>
  Math.max(props.items.length - VISIBLE_CHIPS, 0),
);

async function loadCandidates(): Promise<void> {
  if (!props.project._id) return;
  loading.value = true;
  errorMsg.value = null;
  try {
    const result = await workItemService.listWorkItems({
      projectId: props.project._id,
      type: props.targetType,
      limit: 200,
      sortBy: "title",
      sortDir: "asc",
    });
    candidates.value = result.items;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      errorMsg.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        "Failed to load candidates.";
    } else {
      errorMsg.value = "Failed to load candidates.";
    }
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      search.value = "";
      candidates.value = [];
      errorMsg.value = null;
      submittingId.value = null;
      void loadCandidates();
    }
  },
);

function setOpen(open: boolean): void {
  if (submittingId.value !== null) return;
  emit("update:open", open);
}

async function pickParent(parent: WorkItem): Promise<void> {
  if (submittingId.value !== null) return;
  const toUpdate = props.items.filter(
    (it) => it._id !== parent._id && it.parentId !== parent._id,
  );
  if (toUpdate.length === 0) {
    // Already attached to this parent — close without an API call.
    emit("applied", { parentId: parent._id, updatedItems: [] });
    emit("update:open", false);
    return;
  }
  submittingId.value = parent._id;
  errorMsg.value = null;
  try {
    const updatedItems = await Promise.all(
      toUpdate.map((it) =>
        workItemService.updateWorkItem(it._id, { parentId: parent._id }),
      ),
    );
    emit("applied", { parentId: parent._id, updatedItems });
    emit("update:open", false);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      errorMsg.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        "Failed to connect items.";
    } else {
      errorMsg.value = "Failed to connect items.";
    }
  } finally {
    submittingId.value = null;
  }
}

const childTypeLabel = computed(() => {
  if (props.targetType === "task") return "subtask";
  return "task";
});
</script>

<template>
  <Dialog :open="props.open" @update:open="setOpen">
    <DialogContent
      class="max-w-xl! p-0 overflow-hidden gap-0 flex flex-col border-0 shadow-2xl [&>button]:hidden"
    >
      <!-- Header -->
      <div
        class="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span
            class="inline-flex items-center justify-center size-9 rounded-lg shrink-0"
            :class="[targetMeta.bg, targetMeta.text]"
          >
            <VsxIcon iconName="Link" class="size-5" />
          </span>
          <div class="flex flex-col gap-0.5 min-w-0">
            <DialogTitle class="text-base font-semibold leading-tight">
              Connect to {{ targetMeta.label }}
            </DialogTitle>
            <DialogDescription
              class="text-xs text-muted-foreground leading-tight"
            >
              Make
              <span class="font-medium text-foreground">
                {{ itemCount }} item{{ itemCount === 1 ? "" : "s" }}
              </span>
              a {{ childTypeLabel }} of the picked {{ targetMeta.label
              }}.
            </DialogDescription>
          </div>
        </div>
        <button
          type="button"
          class="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition shrink-0"
          aria-label="Close"
          @click="setOpen(false)"
        >
          <VsxIcon iconName="CloseCircle" class="size-5" />
        </button>
      </div>

      <!-- Selected items preview -->
      <div class="px-6 py-3 border-b bg-muted/20">
        <p
          class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2"
        >
          Selected
        </p>
        <div class="flex flex-wrap items-center gap-1.5">
          <span
            v-for="it in visibleSelected"
            :key="it._id"
            class="inline-flex items-center gap-1.5 rounded-md border bg-card pl-1.5 pr-2 py-1 text-xs max-w-56"
          >
            <VsxIcon
              :iconName="TYPE_META[it.type].icon"
              class="size-3.5 shrink-0"
              :class="TYPE_META[it.type].text"
            />
            <span class="font-mono text-muted-foreground shrink-0">
              {{ it.key }}
            </span>
            <span class="truncate">{{ it.title }}</span>
          </span>
          <span
            v-if="hiddenSelectedCount > 0"
            class="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
          >
            +{{ hiddenSelectedCount }} more
          </span>
        </div>
      </div>

      <!-- Search -->
      <div class="px-6 pt-4 pb-3">
        <p
          class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2"
        >
          Pick a parent {{ targetMeta.label }}
        </p>
        <div class="relative">
          <VsxIcon
            iconName="SearchNormal1"
            class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="search"
            type="search"
            :placeholder="`Search ${targetMeta.label.toLowerCase()}s by title or key…`"
            class="pl-8 h-9"
          />
        </div>
      </div>

      <!-- List -->
      <div class="overflow-y-auto max-h-[45vh] px-3 pb-3 min-h-48">
        <!-- Loading skeleton -->
        <ul v-if="loading" class="flex flex-col gap-0.5">
          <li
            v-for="i in 6"
            :key="`sk-${i}`"
            class="flex items-center gap-3 px-3 py-2.5"
          >
            <div class="size-7 rounded-md bg-muted animate-pulse shrink-0" />
            <div class="flex flex-col gap-1.5 flex-1 min-w-0">
              <div
                class="h-3 rounded bg-muted animate-pulse"
                :style="{ width: `${45 + ((i * 11) % 35)}%` }"
              />
              <div
                class="h-2 rounded bg-muted/70 animate-pulse"
                :style="{ width: `${20 + ((i * 7) % 20)}%` }"
              />
            </div>
          </li>
        </ul>

        <!-- Error -->
        <div
          v-else-if="errorMsg"
          class="flex flex-col items-center justify-center text-center py-10 gap-2"
        >
          <span
            class="inline-flex items-center justify-center size-10 rounded-full bg-destructive/10 text-destructive"
          >
            <VsxIcon iconName="InfoCircle" class="size-5" />
          </span>
          <p class="text-sm font-medium text-destructive">
            {{ errorMsg }}
          </p>
        </div>

        <!-- Empty -->
        <div
          v-else-if="filtered.length === 0"
          class="flex flex-col items-center justify-center text-center py-10 gap-2"
        >
          <span
            class="inline-flex items-center justify-center size-10 rounded-full bg-muted text-muted-foreground"
          >
            <VsxIcon iconName="SearchNormal1" class="size-5" />
          </span>
          <p class="text-sm font-medium">
            {{
              search
                ? `No ${targetMeta.label.toLowerCase()}s match`
                : `No ${targetMeta.label.toLowerCase()}s available`
            }}
          </p>
          <p class="text-xs text-muted-foreground max-w-xs">
            {{
              search
                ? "Try a different keyword."
                : `Create a ${targetMeta.label.toLowerCase()} first to use it as a parent.`
            }}
          </p>
        </div>

        <!-- Results -->
        <ul v-else class="flex flex-col gap-0.5">
          <li v-for="c in filtered" :key="c._id">
            <button
              type="button"
              class="group/row w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left cursor-pointer hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:bg-accent"
              :disabled="submittingId !== null"
              @click="pickParent(c)"
            >
              <span
                class="inline-flex items-center justify-center size-7 rounded-md shrink-0"
                :class="[targetMeta.bg]"
              >
                <VsxIcon
                  :iconName="targetMeta.icon"
                  class="size-4"
                  :class="targetMeta.text"
                />
              </span>
              <span class="flex flex-col min-w-0 flex-1 leading-tight">
                <span class="text-sm font-medium truncate">{{ c.title }}</span>
                <span
                  class="text-[11px] text-muted-foreground font-mono mt-0.5"
                >
                  {{ c.key }}
                </span>
              </span>
              <span
                v-if="submittingId === c._id"
                class="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                <VsxIcon iconName="Refresh" class="size-3.5 animate-spin" />
                Connecting…
              </span>
              <VsxIcon
                v-else
                iconName="ArrowRight2"
                class="size-4 text-muted-foreground opacity-0 group-hover/row:opacity-100 transition-opacity"
              />
            </button>
          </li>
        </ul>
      </div>

      <!-- Footer hint -->
      <div
        class="flex items-center justify-between gap-3 px-6 py-2.5 border-t bg-muted/30"
      >
        <span
          class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <VsxIcon iconName="InfoCircle" class="size-3.5" />
          Click a {{ targetMeta.label.toLowerCase() }} to set it as the parent.
        </span>
      </div>
    </DialogContent>
  </Dialog>
</template>
