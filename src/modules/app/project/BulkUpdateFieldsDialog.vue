<script setup lang="ts">
import { computed, ref, watch } from "vue";
import axios from "axios";
import { VsxIcon } from "vue-iconsax";
import { useUserStore } from "@/store/user";
import { useSprintStore } from "@/store/sprint";
import { useComponentStore } from "@/store/component";
import * as workItemService from "@/services/workItem.service";
import type {
  Project,
  UpdateWorkItemPayload,
  WorkItem,
  WorkItemPriority,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  open: boolean;
  items: WorkItem[];
  project: Project;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  applied: [];
}>();

const userStore = useUserStore();
const sprintStore = useSprintStore();
const componentStore = useComponentStore();

const UNASSIGNED = "__unassigned__";
const NO_SPRINT = "__none__";

type FieldKey =
  | "assignee"
  | "reporter"
  | "priority"
  | "sprint"
  | "dueDate"
  | "storyPoints"
  | "labels"
  | "components";

interface FieldMeta {
  key: FieldKey;
  label: string;
  icon: string;
  iconColor: string;
  hint?: string;
}

const FIELDS: FieldMeta[] = [
  {
    key: "assignee",
    label: "Assignee",
    icon: "User",
    iconColor: "text-sky-600 bg-sky-100",
  },
  {
    key: "reporter",
    label: "Reporter",
    icon: "UserSearch",
    iconColor: "text-violet-600 bg-violet-100",
  },
  {
    key: "priority",
    label: "Priority",
    icon: "Chart",
    iconColor: "text-amber-600 bg-amber-100",
  },
  {
    key: "sprint",
    label: "Sprint",
    icon: "Calendar",
    iconColor: "text-indigo-600 bg-indigo-100",
  },
  {
    key: "dueDate",
    label: "Due date",
    icon: "Calendar",
    iconColor: "text-rose-600 bg-rose-100",
  },
  {
    key: "storyPoints",
    label: "Story points",
    icon: "Diagram",
    iconColor: "text-emerald-600 bg-emerald-100",
  },
  {
    key: "labels",
    label: "Labels",
    icon: "MagicStar",
    iconColor: "text-pink-600 bg-pink-100",
    hint: "added to existing",
  },
  {
    key: "components",
    label: "Components",
    icon: "Element3",
    iconColor: "text-teal-600 bg-teal-100",
    hint: "added to existing",
  },
];

const activeFields = ref<FieldKey[]>([]);

const assigneeValue = ref<string>(UNASSIGNED);
const reporterValue = ref<string>("");
const priorityValue = ref<WorkItemPriority>("medium");
const sprintValue = ref<string>(NO_SPRINT);
const dueDateValue = ref<string>("");
const storyPointsValue = ref<string>("");
const labelsValue = ref<string>("");
const componentsValue = ref<Set<string>>(new Set());

const submitting = ref(false);
const errorMsg = ref<string | null>(null);

const PRIORITIES: { value: WorkItemPriority; label: string; color: string }[] =
  [
    { value: "urgent", label: "Urgent", color: "bg-red-500" },
    { value: "high", label: "High", color: "bg-amber-500" },
    { value: "medium", label: "Medium", color: "bg-blue-500" },
    { value: "low", label: "Low", color: "bg-slate-400" },
  ];

const memberUsers = computed(() => {
  const ids = new Set(props.project.members.map((m) => m.userId));
  return userStore.users.filter((u) => ids.has(u._id));
});

const assignableSprints = computed(() =>
  sprintStore.sprints.filter((s) => s.state !== "closed"),
);

const allComponents = computed(() => componentStore.components);

const itemCount = computed(() => props.items.length);
const availableFields = computed<FieldMeta[]>(() =>
  FIELDS.filter((f) => !activeFields.value.includes(f.key)),
);

const fieldByKey = computed<Map<FieldKey, FieldMeta>>(() => {
  const m = new Map<FieldKey, FieldMeta>();
  for (const f of FIELDS) m.set(f.key, f);
  return m;
});

function addField(key: FieldKey): void {
  if (activeFields.value.includes(key)) return;
  activeFields.value = [...activeFields.value, key];
}

function removeField(key: FieldKey): void {
  activeFields.value = activeFields.value.filter((k) => k !== key);
}

function toggleComponent(id: string): void {
  const next = new Set(componentsValue.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  componentsValue.value = next;
}

function reset(): void {
  activeFields.value = [];
  assigneeValue.value = UNASSIGNED;
  reporterValue.value = "";
  priorityValue.value = "medium";
  sprintValue.value = NO_SPRINT;
  dueDateValue.value = "";
  storyPointsValue.value = "";
  labelsValue.value = "";
  componentsValue.value = new Set();
  errorMsg.value = null;
}

watch(
  () => props.open,
  (open) => {
    if (open) reset();
  },
);

function setOpen(open: boolean): void {
  if (submitting.value) return;
  emit("update:open", open);
}

function parseLabels(): string[] {
  return labelsValue.value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function buildPayloadFor(item: WorkItem): UpdateWorkItemPayload | null {
  const payload: UpdateWorkItemPayload = {};
  let touched = false;
  const active = new Set(activeFields.value);

  if (active.has("assignee")) {
    payload.assigneeId =
      assigneeValue.value === UNASSIGNED ? null : assigneeValue.value;
    touched = true;
  }
  if (active.has("reporter") && reporterValue.value) {
    payload.reporterId = reporterValue.value;
    touched = true;
  }
  if (active.has("priority")) {
    payload.priority = priorityValue.value;
    touched = true;
  }
  if (active.has("sprint")) {
    payload.sprintId =
      sprintValue.value === NO_SPRINT ? null : sprintValue.value;
    touched = true;
  }
  if (active.has("dueDate")) {
    payload.dueDate = dueDateValue.value
      ? new Date(dueDateValue.value).toISOString()
      : null;
    touched = true;
  }
  if (active.has("storyPoints")) {
    payload.storyPoints = storyPointsValue.value
      ? Number(storyPointsValue.value)
      : null;
    touched = true;
  }
  if (active.has("labels")) {
    const toAdd = parseLabels();
    if (toAdd.length > 0) {
      payload.labels = [...new Set([...item.labels, ...toAdd])];
      touched = true;
    }
  }
  if (active.has("components")) {
    const toAdd = [...componentsValue.value];
    if (toAdd.length > 0) {
      payload.componentIds = [...new Set([...item.componentIds, ...toAdd])];
      touched = true;
    }
  }

  return touched ? payload : null;
}

async function apply(): Promise<void> {
  if (activeFields.value.length === 0 || submitting.value) return;
  submitting.value = true;
  errorMsg.value = null;
  try {
    const jobs: Promise<unknown>[] = [];
    for (const it of props.items) {
      const payload = buildPayloadFor(it);
      if (payload) jobs.push(workItemService.updateWorkItem(it._id, payload));
    }
    await Promise.all(jobs);
    emit("applied");
    emit("update:open", false);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      errorMsg.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        "Failed to update work items.";
    } else {
      errorMsg.value = "Failed to update work items.";
    }
  } finally {
    submitting.value = false;
  }
}
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
            class="inline-flex items-center justify-center size-9 rounded-lg bg-primary text-foreground shrink-0"
          >
            <VsxIcon iconName="Edit2" class="size-5" />
          </span>
          <div class="flex flex-col gap-0.5 min-w-0">
            <DialogTitle class="text-base font-semibold leading-tight">
              Update fields
            </DialogTitle>
            <DialogDescription
              class="text-xs text-muted-foreground leading-tight"
            >
              Changes will apply to
              <span class="font-medium text-foreground">
                {{ itemCount }} work item{{ itemCount === 1 ? "" : "s" }}
              </span>
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

      <!-- Body -->
      <div class="overflow-y-auto max-h-[60vh] px-6 py-5">
        <!-- Empty state -->
        <div
          v-if="activeFields.length === 0"
          class="flex flex-col items-center justify-center text-center py-8 gap-3 rounded-lg border-2 border-dashed border-border bg-muted/20"
        >
          <span
            class="inline-flex items-center justify-center size-12 rounded-full bg-muted text-muted-foreground"
          >
            <VsxIcon iconName="Setting2" class="size-6" />
          </span>
          <div class="flex flex-col gap-1">
            <p class="text-sm font-medium">No fields selected</p>
            <p class="text-xs text-muted-foreground max-w-xs">
              Pick the fields you want to update across all selected work items.
            </p>
          </div>
        </div>

        <!-- Active field rows -->
        <ul v-else class="flex flex-col gap-2">
          <TransitionGroup
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in absolute"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <li
              v-for="key in activeFields"
              :key="key"
              class="group relative flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-foreground/20 transition-colors"
            >
              <span
                class="inline-flex items-center justify-center size-8 rounded-md shrink-0"
                :class="fieldByKey.get(key)?.iconColor"
              >
                <VsxIcon
                  :iconName="fieldByKey.get(key)?.icon ?? 'TaskSquare'"
                  class="size-4"
                />
              </span>

              <div class="flex flex-col gap-0 min-w-0 w-32 shrink-0">
                <span class="text-sm font-medium leading-tight">
                  {{ fieldByKey.get(key)?.label }}
                </span>
                <span
                  v-if="fieldByKey.get(key)?.hint"
                  class="text-[10px] text-muted-foreground leading-tight"
                >
                  {{ fieldByKey.get(key)?.hint }}
                </span>
              </div>

              <!-- Per-field editor -->
              <div class="flex-1 min-w-0">
                <!-- Assignee -->
                <Select v-if="key === 'assignee'" v-model="assigneeValue">
                  <SelectTrigger class="h-9 w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="UNASSIGNED">
                      <span class="text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    <SelectItem
                      v-for="u in memberUsers"
                      :key="u._id"
                      :value="u._id"
                    >
                      <span class="inline-flex items-center gap-2">
                        <Avatar class="size-5">
                          <AvatarFallback class="text-[9px]">
                            {{ userStore.initials(u._id) }}
                          </AvatarFallback>
                        </Avatar>
                        {{ u.name }}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <!-- Reporter -->
                <Select v-else-if="key === 'reporter'" v-model="reporterValue">
                  <SelectTrigger class="h-9 w-full">
                    <SelectValue placeholder="Pick a member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="u in memberUsers"
                      :key="u._id"
                      :value="u._id"
                    >
                      <span class="inline-flex items-center gap-2">
                        <Avatar class="size-5">
                          <AvatarFallback class="text-[9px]">
                            {{ userStore.initials(u._id) }}
                          </AvatarFallback>
                        </Avatar>
                        {{ u.name }}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <!-- Priority -->
                <Select v-else-if="key === 'priority'" v-model="priorityValue">
                  <SelectTrigger class="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="p in PRIORITIES"
                      :key="p.value"
                      :value="p.value"
                    >
                      <span class="inline-flex items-center gap-2">
                        <span
                          :class="['inline-block size-2 rounded-full', p.color]"
                        />
                        {{ p.label }}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <!-- Sprint -->
                <Select v-else-if="key === 'sprint'" v-model="sprintValue">
                  <SelectTrigger class="h-9 w-full">
                    <SelectValue placeholder="Backlog" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="NO_SPRINT">
                      <span class="text-muted-foreground">Backlog</span>
                    </SelectItem>
                    <SelectItem
                      v-for="s in assignableSprints"
                      :key="s._id"
                      :value="s._id"
                    >
                      {{ s.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <!-- Due date -->
                <Input
                  v-else-if="key === 'dueDate'"
                  v-model="dueDateValue"
                  type="date"
                  class="h-9"
                />

                <!-- Story points -->
                <Input
                  v-else-if="key === 'storyPoints'"
                  v-model="storyPointsValue"
                  type="number"
                  min="0"
                  step="0.5"
                  class="h-9"
                  placeholder="—"
                />

                <!-- Labels -->
                <Input
                  v-else-if="key === 'labels'"
                  v-model="labelsValue"
                  class="h-9"
                  placeholder="comma-separated, e.g. bug, frontend"
                />

                <!-- Components -->
                <div v-else-if="key === 'components'" class="py-1">
                  <div
                    v-if="allComponents.length === 0"
                    class="text-xs text-muted-foreground italic"
                  >
                    No components defined for this project.
                  </div>
                  <div v-else class="flex flex-wrap gap-1.5">
                    <button
                      v-for="c in allComponents"
                      :key="c._id"
                      type="button"
                      class="cursor-pointer text-xs px-2 py-1 rounded-full border transition-colors"
                      :class="
                        componentsValue.has(c._id)
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'border-border hover:border-primary/40'
                      "
                      @click="toggleComponent(c._id)"
                    >
                      {{ c.name }}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                class="cursor-pointer rounded-md p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-destructive transition shrink-0"
                aria-label="Remove field"
                @click="removeField(key)"
              >
                <VsxIcon iconName="Trash" class="size-4" />
              </button>
            </li>
          </TransitionGroup>
        </ul>

        <!-- Add field button -->
        <div v-if="availableFields.length > 0" class="mt-3">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 cursor-pointer rounded-md px-2 py-1.5 hover:bg-primary/5 transition-colors"
              >
                <VsxIcon iconName="AddCircle" class="size-4" />
                <span>Add field to update</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="min-w-52">
              <DropdownMenuItem
                v-for="f in availableFields"
                :key="f.key"
                @select="addField(f.key)"
              >
                <span
                  class="inline-flex items-center justify-center size-6 rounded-md shrink-0"
                  :class="f.iconColor"
                >
                  <VsxIcon :iconName="f.icon" class="size-3.5" />
                </span>
                <span>{{ f.label }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex items-center justify-between gap-3 px-6 py-3.5 border-t bg-muted/30"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span
            v-if="errorMsg"
            class="inline-flex items-center gap-1.5 text-xs text-destructive"
          >
            <VsxIcon iconName="InfoCircle" class="size-3.5" />
            {{ errorMsg }}
          </span>
          <span
            v-else-if="activeFields.length > 0"
            class="text-xs text-muted-foreground"
          >
            <span class="font-medium text-foreground">
              {{ activeFields.length }}
            </span>
            field{{ activeFields.length === 1 ? "" : "s" }} ·
            <span class="font-medium text-foreground">{{ itemCount }}</span>
            item{{ itemCount === 1 ? "" : "s" }}
          </span>
        </div>
        <div class="flex gap-2 shrink-0">
          <Button
            variant="outline"
            :disabled="submitting"
            @click="setOpen(false)"
          >
            Cancel
          </Button>
          <Button
            :disabled="activeFields.length === 0 || submitting"
            class="gap-1.5"
            @click="apply"
          >
            <VsxIcon v-if="!submitting" iconName="TickCircle" class="size-4" />
            {{ submitting ? "Updating…" : "Apply changes" }}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
