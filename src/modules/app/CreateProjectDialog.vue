<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import axios from "axios";
import { VsxIcon } from "vue-iconsax";
import { useCreateProject } from "@/store/project";
import { useAuthStore } from "@/store/auth";
import * as userService from "@/services/user.service";
import type {
  ProjectAccess,
  ProjectManagement,
  ProjectMemberRole,
  ProjectTemplate,
  User,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [projectSlug: string];
}>();

const createProjectMutation = useCreateProject();
const authStore = useAuthStore();

interface FieldErrors {
  name?: string;
  key?: string;
}

interface MemberRow {
  user: User;
  role: ProjectMemberRole;
}

const TEMPLATES: {
  id: ProjectTemplate;
  title: string;
  blurb: string;
  icon: string;
  accent: string;
}[] = [
  {
    id: "board",
    title: "Board",
    blurb: "Visualize work as cards moving through columns.",
    icon: "Element3",
    accent: "from-sky-500/15 to-indigo-500/10",
  },
  {
    id: "list",
    title: "List",
    blurb: "Track work as a sortable, structured list.",
    icon: "TaskSquare",
    accent: "from-emerald-500/15 to-teal-500/10",
  },
];

const ROLE_OPTIONS: {
  value: ProjectMemberRole;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "administrator",
    label: "Administrator",
    description: "Full project control",
    icon: "ShieldTick",
  },
  {
    value: "member",
    label: "Member",
    description: "Create and update tasks",
    icon: "User",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access",
    icon: "Eye",
  },
];

const STEPS = [
  { id: 1, label: "Template", hint: "Pick a starting view" },
  { id: 2, label: "Details", hint: "Name your project" },
  { id: 3, label: "Members", hint: "Invite your team" },
] as const;

const step = ref<1 | 2 | 3>(1);
const submitting = ref(false);
const formError = ref<string | null>(null);
const fieldErrors = reactive<FieldErrors>({});

const form = reactive<{
  template: ProjectTemplate;
  name: string;
  description: string;
  management: ProjectManagement;
  access: ProjectAccess;
  key: string;
  keyTouched: boolean;
}>({
  template: "board",
  name: "",
  description: "",
  management: "team-managed",
  access: "open",
  key: "",
  keyTouched: false,
});

const memberRows = ref<MemberRow[]>([]);
const tenantUsers = ref<User[]>([]);
const usersLoading = ref(false);
const usersError = ref<string | null>(null);
const memberSearch = ref("");

watch(
  () => props.open,
  (next) => {
    if (next) reset();
  },
);

watch(
  () => form.name,
  (name) => {
    if (!form.keyTouched) form.key = deriveKey(name);
  },
);

function deriveKey(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9 ]/g, "").trim();
  if (!cleaned) return "";
  const words = cleaned.split(/\s+/).filter(Boolean);
  let candidate: string;
  if (words.length >= 2) candidate = words.map((w) => w[0]).join("");
  else candidate = words[0]!;
  candidate = candidate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return candidate.slice(0, 6) || "PRJ";
}

function reset(): void {
  step.value = 1;
  form.template = "board";
  form.name = "";
  form.description = "";
  form.management = "team-managed";
  form.access = "open";
  form.key = "";
  form.keyTouched = false;
  fieldErrors.name = undefined;
  fieldErrors.key = undefined;
  formError.value = null;
  submitting.value = false;
  memberRows.value = [];
  memberSearch.value = "";
  void loadTenantUsers();
}

async function loadTenantUsers(): Promise<void> {
  usersLoading.value = true;
  usersError.value = null;
  try {
    tenantUsers.value = await userService.listUsers();
  } catch {
    usersError.value =
      "Could not load teammates. You can still create the project.";
  } finally {
    usersLoading.value = false;
  }
}

function setOpen(value: boolean): void {
  emit("update:open", value);
}
function setTemplate(t: ProjectTemplate): void {
  form.template = t;
}

function onKeyInput(value: string): void {
  form.keyTouched = true;
  form.key = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  fieldErrors.key = undefined;
}

const currentUserId = computed<string>(() => authStore.user?._id ?? "");

const selectedIds = computed<Set<string>>(
  () => new Set(memberRows.value.map((m) => m.user._id)),
);

const filteredCandidates = computed<User[]>(() => {
  const q = memberSearch.value.trim().toLowerCase();
  return tenantUsers.value
    .filter((u) => u._id !== currentUserId.value)
    .filter((u) => !selectedIds.value.has(u._id))
    .filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    })
    .slice(0, 6);
});

function addMember(user: User): void {
  if (selectedIds.value.has(user._id)) return;
  memberRows.value.push({ user, role: "member" });
  memberSearch.value = "";
}
function removeMember(userId: string): void {
  memberRows.value = memberRows.value.filter((m) => m.user._id !== userId);
}
function setMemberRole(userId: string, role: ProjectMemberRole): void {
  const row = memberRows.value.find((m) => m.user._id === userId);
  if (row) row.role = role;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const previewName = computed(() => form.name.trim() || "Project name");
const previewKey = computed(() => form.key || "KEY");
const previewDescription = computed(
  () =>
    form.description.trim() ||
    "Add a short description so teammates know what this project is for.",
);

function validateStep2(): boolean {
  fieldErrors.name = undefined;
  fieldErrors.key = undefined;
  let ok = true;
  if (form.name.trim().length < 2) {
    fieldErrors.name = "Name must be at least 2 characters";
    ok = false;
  }
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(form.key)) {
    fieldErrors.key =
      "Key: 2–10 chars, letters/digits, must start with a letter";
    ok = false;
  }
  return ok;
}

function goToStep(target: 1 | 2 | 3): void {
  if (target === step.value) return;
  if (target > step.value) {
    if (step.value === 2 && !validateStep2()) return;
  }
  step.value = target;
}

function next(): void {
  formError.value = null;
  if (step.value === 1) {
    step.value = 2;
    return;
  }
  if (step.value === 2) {
    if (!validateStep2()) return;
    step.value = 3;
  }
}

function back(): void {
  formError.value = null;
  if (step.value === 2) step.value = 1;
  else if (step.value === 3) step.value = 2;
}

async function submit(): Promise<void> {
  formError.value = null;
  if (!validateStep2()) {
    step.value = 2;
    return;
  }
  submitting.value = true;
  try {
    const project = await createProjectMutation.mutateAsync({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      template: form.template,
      key: form.key,
      management: form.management,
      access: form.access,
      members: memberRows.value.map((m) => ({
        userId: m.user._id,
        role: m.role,
      })),
    });
    emit("created", project.slug);
    emit("update:open", false);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const message = (err.response?.data as { message?: string } | undefined)
        ?.message;
      formError.value =
        message ?? "Failed to create project. Please try again.";
      if (message?.toLowerCase().includes("key")) {
        fieldErrors.key = message;
        step.value = 2;
      }
    } else {
      formError.value = "Unexpected error. Please try again.";
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Dialog :open="props.open" @update:open="setOpen">
    <DialogContent
      class="max-w-260! p-0 overflow-hidden gap-0 border-0 shadow-2xl [&>button]:hidden"
    >
      <DialogTitle class="sr-only">Create project</DialogTitle>
      <DialogDescription class="sr-only">
        Step {{ step }} of 3 — {{ STEPS[step - 1].label }}
      </DialogDescription>

      <div class="grid grid-cols-[minmax(0,1fr)_420px] h-155">
        <!-- ======================== LEFT: form ======================== -->
        <div class="flex flex-col bg-background h-full min-h-0">
          <!-- Header + stepper -->
          <div class="px-8 pt-7 pb-5">
            <div class="flex items-start justify-between mb-6">
              <div>
                <p
                  class="text-xs font-semibold uppercase tracking-[0.18em] text-primary"
                >
                  New project
                </p>
                <h2 class="mt-1 text-2xl font-semibold tracking-tight">
                  {{ STEPS[step - 1].label }}
                </h2>
                <p class="mt-1 text-sm text-muted-foreground">
                  {{ STEPS[step - 1].hint }}
                </p>
              </div>
              <button
                type="button"
                class="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                aria-label="Close"
                @click="setOpen(false)"
              >
                <VsxIcon iconName="Add" class="size-4 rotate-45" />
              </button>
            </div>

            <!-- Stepper -->
            <ol class="flex items-center gap-3">
              <template v-for="(s, idx) in STEPS" :key="s.id">
                <li class="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    class="flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-all disabled:cursor-not-allowed enabled:cursor-pointer"
                    :class="
                      s.id < step
                        ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                        : s.id === step
                          ? 'bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    "
                    :disabled="s.id > step"
                    @click="goToStep(s.id as 1 | 2 | 3)"
                  >
                    <VsxIcon
                      v-if="s.id < step"
                      iconName="TickCircle"
                      class="size-4"
                    />
                    <span v-else>{{ s.id }}</span>
                  </button>
                  <span
                    class="text-sm font-medium hidden sm:inline"
                    :class="
                      s.id === step
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    "
                    >{{ s.label }}</span
                  >
                </li>
                <li
                  v-if="idx < STEPS.length - 1"
                  class="flex-1 h-px bg-border relative"
                >
                  <div
                    class="absolute inset-y-0 left-0 bg-primary transition-all duration-300"
                    :style="{ width: s.id < step ? '100%' : '0%' }"
                  />
                </li>
              </template>
            </ol>
          </div>

          <div class="h-px bg-border" />

          <!-- Body -->
          <div class="cp-scroll flex-1 min-h-0 px-8 py-6 overflow-y-auto">
            <!-- ─────── STEP 1: Template ─────── -->
            <div v-if="step === 1" class="space-y-3">
              <button
                v-for="t in TEMPLATES"
                :key="t.id"
                type="button"
                class="group w-full cursor-pointer rounded-xl border p-5 text-left transition-all hover:shadow-sm"
                :class="
                  form.template === t.id
                    ? 'border-primary bg-primary/4'
                    : 'border-border bg-card hover:border-primary/40'
                "
                @click="setTemplate(t.id)"
              >
                <div class="flex items-start gap-4">
                  <div
                    class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br transition-colors"
                    :class="[
                      t.accent,
                      form.template === t.id ? 'ring-1 ring-primary/30' : '',
                    ]"
                  >
                    <VsxIcon :iconName="t.icon" class="size-6 text-primary" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <h3 class="font-semibold text-base">{{ t.title }}</h3>
                      <div
                        v-if="form.template === t.id"
                        class="flex items-center gap-1 text-xs font-medium text-primary"
                      >
                        <VsxIcon iconName="TickCircle" class="size-4" />
                        Selected
                      </div>
                    </div>
                    <p
                      class="mt-1 text-sm text-muted-foreground leading-relaxed"
                    >
                      {{ t.blurb }}
                    </p>
                  </div>
                </div>
              </button>

              <div
                class="mt-4 flex items-start gap-2.5 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground"
              >
                <VsxIcon iconName="InfoCircle" class="size-4 shrink-0 mt-0.5" />
                <p>
                  You can switch between Board and List view inside the project
                  at any time.
                </p>
              </div>
            </div>

            <!-- ─────── STEP 2: Details ─────── -->
            <div v-if="step === 2" class="space-y-5">
              <div class="space-y-2">
                <Label for="cp-name" class="text-sm font-medium">
                  Project name <span class="text-destructive">*</span>
                </Label>
                <Input
                  id="cp-name"
                  v-model="form.name"
                  placeholder="e.g. Acme website redesign"
                  class="h-11"
                  :aria-invalid="!!fieldErrors.name"
                  :disabled="submitting"
                />
                <p
                  v-if="fieldErrors.name"
                  class="text-xs text-destructive flex items-center gap-1"
                >
                  <VsxIcon iconName="InfoCircle" class="size-3.5" />
                  {{ fieldErrors.name }}
                </p>
              </div>

              <div class="space-y-2">
                <Label for="cp-description" class="text-sm font-medium"
                  >Description</Label
                >
                <Textarea
                  id="cp-description"
                  v-model="form.description"
                  placeholder="What is this project about?"
                  :disabled="submitting"
                  rows="3"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label class="text-sm font-medium">
                    How it's managed <span class="text-destructive">*</span>
                  </Label>
                  <Select v-model="form.management" :disabled="submitting">
                    <SelectTrigger class="h-11 w-full cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team-managed">
                        <span class="inline-flex items-center gap-2">
                          <VsxIcon iconName="People" class="size-4" />
                          Team-managed
                        </span>
                      </SelectItem>
                      <SelectItem value="company-managed">
                        <span class="inline-flex items-center gap-2">
                          <VsxIcon iconName="ShieldTick" class="size-4" />
                          Company-managed
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="space-y-2">
                  <Label class="text-sm font-medium">
                    Access <span class="text-destructive">*</span>
                  </Label>
                  <Select v-model="form.access" :disabled="submitting">
                    <SelectTrigger class="h-11 w-full cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">
                        <span class="inline-flex items-center gap-2">
                          <VsxIcon iconName="Unlock" class="size-4" />
                          Open
                        </span>
                      </SelectItem>
                      <SelectItem value="private">
                        <span class="inline-flex items-center gap-2">
                          <VsxIcon iconName="Lock1" class="size-4" />
                          Private
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div class="space-y-2">
                <Label for="cp-key" class="text-sm font-medium">
                  Key <span class="text-destructive">*</span>
                </Label>
                <div class="flex items-center gap-3">
                  <Input
                    id="cp-key"
                    :model-value="form.key"
                    placeholder="ACME"
                    class="font-mono uppercase tracking-[0.2em] w-44 h-11 text-center font-semibold"
                    :aria-invalid="!!fieldErrors.key"
                    :disabled="submitting"
                    @update:model-value="(v) => onKeyInput(String(v ?? ''))"
                  />
                  <p class="text-xs text-muted-foreground">
                    Used as a prefix for tasks —
                    <span class="font-mono font-medium text-foreground"
                      >{{ previewKey }}-1</span
                    >,
                    <span class="font-mono font-medium text-foreground"
                      >{{ previewKey }}-2</span
                    >, …
                  </p>
                </div>
                <p
                  v-if="fieldErrors.key"
                  class="text-xs text-destructive flex items-center gap-1"
                >
                  <VsxIcon iconName="InfoCircle" class="size-3.5" />
                  {{ fieldErrors.key }}
                </p>
              </div>
            </div>

            <!-- ─────── STEP 3: Members ─────── -->
            <div v-if="step === 3" class="space-y-5">
              <div class="space-y-2">
                <Label for="cp-search" class="text-sm font-medium"
                  >Add teammate</Label
                >
                <div class="relative">
                  <VsxIcon
                    iconName="SearchNormal1"
                    class="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                  />
                  <Input
                    id="cp-search"
                    v-model="memberSearch"
                    placeholder="Search by name or email…"
                    class="h-11 pl-10"
                    :disabled="submitting || usersLoading"
                  />
                </div>
                <p v-if="usersError" class="text-xs text-destructive">
                  {{ usersError }}
                </p>

                <div
                  v-if="memberSearch && filteredCandidates.length"
                  class="rounded-lg border bg-popover shadow-md divide-y overflow-hidden"
                >
                  <button
                    v-for="u in filteredCandidates"
                    :key="u._id"
                    type="button"
                    class="w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                    @click="addMember(u)"
                  >
                    <Avatar class="size-9">
                      <AvatarFallback
                        class="text-xs bg-linear-to-br from-primary/20 to-primary/5 text-primary"
                      >
                        {{ initialsOf(u.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium truncate">{{ u.name }}</p>
                      <p class="text-xs text-muted-foreground truncate">
                        {{ u.email }}
                      </p>
                    </div>
                    <span class="text-xs text-primary font-medium">+ Add</span>
                  </button>
                </div>
                <p
                  v-else-if="memberSearch && !usersLoading"
                  class="text-xs text-muted-foreground px-1"
                >
                  No teammates match "{{ memberSearch }}".
                </p>
              </div>

              <!-- Selected list -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label class="text-sm font-medium">People with access</Label>
                  <span class="text-xs text-muted-foreground">
                    {{ memberRows.length + 1 }}
                    {{ memberRows.length === 0 ? "person" : "people" }}
                  </span>
                </div>

                <div class="rounded-xl border bg-card divide-y overflow-hidden">
                  <!-- Owner row -->
                  <div class="flex items-center gap-3 px-4 py-3 bg-primary/4">
                    <Avatar class="size-10">
                      <AvatarFallback
                        class="bg-primary/15 text-primary text-xs font-semibold"
                      >
                        {{ initialsOf(authStore.user?.name ?? "You") }}
                      </AvatarFallback>
                    </Avatar>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium truncate">
                        {{ authStore.user?.name ?? "You" }}
                        <span
                          class="ml-1.5 text-xs text-muted-foreground font-normal"
                          >(you)</span
                        >
                      </p>
                      <p class="text-xs text-muted-foreground truncate">
                        {{ authStore.user?.email }}
                      </p>
                    </div>
                    <span
                      class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary"
                    >
                      <VsxIcon iconName="ShieldTick" class="size-3.5" />
                      Administrator
                    </span>
                  </div>

                  <div
                    v-for="row in memberRows"
                    :key="row.user._id"
                    class="flex items-center gap-3 px-4 py-3"
                  >
                    <Avatar class="size-10">
                      <AvatarFallback
                        class="text-xs bg-linear-to-br from-primary/20 to-primary/5 text-primary"
                      >
                        {{ initialsOf(row.user.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium truncate">
                        {{ row.user.name }}
                      </p>
                      <p class="text-xs text-muted-foreground truncate">
                        {{ row.user.email }}
                      </p>
                    </div>
                    <Select
                      :model-value="row.role"
                      @update:model-value="
                        (v) =>
                          setMemberRole(row.user._id, v as ProjectMemberRole)
                      "
                    >
                      <SelectTrigger class="w-36 h-9 text-xs cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="r in ROLE_OPTIONS"
                          :key="r.value"
                          :value="r.value"
                        >
                          <div class="flex flex-col py-0.5">
                            <span class="text-sm font-medium">{{
                              r.label
                            }}</span>
                            <span class="text-[10px] text-muted-foreground">{{
                              r.description
                            }}</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      class="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                      aria-label="Remove member"
                      @click="removeMember(row.user._id)"
                    >
                      <VsxIcon iconName="Add" class="size-4 rotate-45" />
                    </button>
                  </div>

                  <div
                    v-if="memberRows.length === 0"
                    class="px-4 py-8 text-center text-xs text-muted-foreground"
                  >
                    Search above to invite teammates — or add them later.
                  </div>
                </div>
              </div>
            </div>

            <p
              v-if="formError"
              class="mt-4 text-sm text-destructive flex items-start gap-1.5"
            >
              <VsxIcon iconName="InfoCircle" class="size-4 shrink-0 mt-0.5" />
              {{ formError }}
            </p>
          </div>

          <!-- Footer -->
          <div
            class="px-8 py-4 border-t bg-muted/20 flex items-center justify-between"
          >
            <Button
              v-if="step > 1"
              type="button"
              variant="ghost"
              class="cursor-pointer"
              :disabled="submitting"
              @click="back"
            >
              <VsxIcon iconName="ArrowLeft2" class="size-4 mr-1" /> Back
            </Button>
            <span v-else />

            <div class="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                class="cursor-pointer"
                :disabled="submitting"
                @click="setOpen(false)"
              >
                Cancel
              </Button>
              <Button
                v-if="step < 3"
                type="button"
                class="cursor-pointer"
                :disabled="submitting"
                @click="next"
              >
                Continue <VsxIcon iconName="ArrowRight2" class="size-4 ml-1" />
              </Button>
              <Button
                v-else
                type="button"
                class="cursor-pointer"
                :disabled="submitting"
                @click="submit"
              >
                <VsxIcon
                  v-if="!submitting"
                  iconName="MagicStar"
                  class="size-4 mr-1.5"
                />
                {{ submitting ? "Creating…" : "Create project" }}
              </Button>
            </div>
          </div>
        </div>

        <!-- ======================== RIGHT: live preview ======================== -->
        <div
          class="relative hidden md:flex flex-col overflow-hidden bg-linear-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border-l"
        >
          <!-- decorative blobs -->
          <div
            class="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            class="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-indigo-400/10 blur-3xl"
          />

          <div class="relative px-7 pt-8 pb-4">
            <p
              class="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground"
            >
              Live preview
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              This is what your project will look like.
            </p>
          </div>

          <!-- Preview card -->
          <div class="relative px-6 pb-6 flex-1 flex flex-col min-h-0">
            <div
              class="rounded-2xl border bg-card/95 backdrop-blur shadow-xl flex-1 flex flex-col overflow-hidden"
            >
              <!-- mini browser chrome -->
              <div
                class="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-1.5"
              >
                <span class="size-2.5 rounded-full bg-red-400/70" />
                <span class="size-2.5 rounded-full bg-amber-400/70" />
                <span class="size-2.5 rounded-full bg-emerald-400/70" />
                <span
                  class="ml-3 text-[10px] font-mono text-muted-foreground truncate"
                >
                  projectflow.app/projects/{{
                    form.name
                      ? form.name
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .slice(0, 20)
                      : "new-project"
                  }}
                </span>
              </div>

              <!-- preview header -->
              <div class="px-5 pt-5 pb-3 border-b">
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-primary"
                  >
                    {{ previewKey }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded text-muted-foreground bg-muted"
                  >
                    <VsxIcon
                      :iconName="form.access === 'private' ? 'Lock1' : 'Unlock'"
                      class="size-3"
                    />
                    {{ form.access === "private" ? "Private" : "Open" }}
                  </span>
                </div>
                <h3 class="mt-2 text-base font-semibold truncate">
                  {{ previewName }}
                </h3>
                <p class="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {{ previewDescription }}
                </p>

                <!-- tabs -->
                <div class="mt-3 flex gap-3 text-[11px] font-medium">
                  <span
                    class="pb-1.5 border-b-2 flex items-center gap-1"
                    :class="
                      form.template === 'board'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground'
                    "
                  >
                    <VsxIcon iconName="Element3" class="size-3.5" /> Board
                  </span>
                  <span
                    class="pb-1.5 border-b-2 flex items-center gap-1"
                    :class="
                      form.template === 'list'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground'
                    "
                  >
                    <VsxIcon iconName="TaskSquare" class="size-3.5" /> List
                  </span>
                </div>
              </div>

              <!-- preview body: morphs by step -->
              <div class="flex-1 p-4 min-h-0 overflow-hidden">
                <!-- BOARD MOCK -->
                <div
                  v-if="form.template === 'board'"
                  class="grid grid-cols-3 gap-2 h-full"
                >
                  <div
                    v-for="(col, idx) in [
                      { name: 'To do', count: 3 },
                      { name: 'In progress', count: 2 },
                      { name: 'Done', count: 1 },
                    ]"
                    :key="col.name"
                    class="rounded-lg bg-muted/40 p-2 flex flex-col gap-1.5 min-h-0"
                  >
                    <div class="flex items-center justify-between px-1">
                      <span
                        class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {{ col.name }}
                      </span>
                      <span class="text-[10px] text-muted-foreground">{{
                        col.count
                      }}</span>
                    </div>
                    <div
                      v-for="n in col.count"
                      :key="n"
                      class="rounded-md border bg-card p-2 shadow-sm"
                      :class="
                        step === 3 && idx === 0 && n === 1
                          ? 'ring-1 ring-primary/40'
                          : ''
                      "
                    >
                      <div class="flex items-center gap-1 mb-1">
                        <span
                          class="text-[9px] font-mono font-semibold text-primary"
                        >
                          {{ previewKey }}-{{ idx * 3 + n }}
                        </span>
                      </div>
                      <div class="h-1.5 rounded-full bg-muted w-3/4" />
                      <div class="h-1.5 rounded-full bg-muted w-1/2 mt-1" />
                      <div
                        v-if="step === 3 && memberRows.length > 0 && n === 1"
                        class="mt-2 flex"
                      >
                        <Avatar class="size-4 ring-1 ring-card">
                          <AvatarFallback class="text-[7px]">
                            {{ initialsOf(memberRows[0]?.user.name ?? "") }}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- LIST MOCK -->
                <div v-else class="flex flex-col h-full">
                  <div
                    class="grid grid-cols-[20px_1fr_60px_50px] gap-2 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground border-b"
                  >
                    <span></span>
                    <span>Title</span>
                    <span>Status</span>
                    <span>Assignee</span>
                  </div>
                  <div class="flex-1 divide-y overflow-hidden">
                    <div
                      v-for="(item, i) in [
                        { state: 'To do', color: 'bg-slate-400' },
                        { state: 'In progress', color: 'bg-blue-500' },
                        { state: 'In review', color: 'bg-amber-500' },
                        { state: 'Done', color: 'bg-emerald-500' },
                      ]"
                      :key="i"
                      class="grid grid-cols-[20px_1fr_60px_50px] gap-2 px-2 py-2 items-center"
                      :class="step === 3 && i === 0 ? 'bg-primary/5' : ''"
                    >
                      <span class="text-[9px] font-mono text-primary truncate"
                        >{{ previewKey }}-{{ i + 1 }}</span
                      >
                      <div>
                        <div class="h-1.5 rounded-full bg-muted w-3/4" />
                      </div>
                      <span
                        class="inline-flex items-center gap-1 text-[9px] font-medium"
                      >
                        <span
                          class="size-1.5 rounded-full"
                          :class="item.color"
                        />
                        {{ item.state }}
                      </span>
                      <Avatar
                        v-if="step === 3 && memberRows.length > 0 && i < 2"
                        class="size-5"
                      >
                        <AvatarFallback class="text-[8px]">
                          {{
                            initialsOf(
                              memberRows[i % memberRows.length]?.user.name ??
                                "",
                            )
                          }}
                        </AvatarFallback>
                      </Avatar>
                      <Avatar v-else class="size-5">
                        <AvatarFallback
                          class="text-[8px] bg-muted text-muted-foreground"
                          >·</AvatarFallback
                        >
                      </Avatar>
                    </div>
                  </div>
                </div>
              </div>

              <!-- footer info strip -->
              <div
                class="px-5 py-2.5 border-t bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground"
              >
                <span class="inline-flex items-center gap-1">
                  <VsxIcon
                    :iconName="
                      form.management === 'company-managed'
                        ? 'ShieldTick'
                        : 'People'
                    "
                    class="size-3"
                  />
                  {{
                    form.management === "company-managed"
                      ? "Company-managed"
                      : "Team-managed"
                  }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <VsxIcon iconName="Profile2User" class="size-3" />
                  {{ memberRows.length + 1 }}
                  {{ memberRows.length === 0 ? "member" : "members" }}
                </span>
              </div>
            </div>

            <!-- step 3 mini-roster summary -->
            <div v-if="step === 3 && memberRows.length > 0" class="mt-3">
              <p
                class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 px-1"
              >
                Roster
              </p>
              <div class="flex -space-x-1.5">
                <Avatar class="size-7 ring-2 ring-background">
                  <AvatarFallback
                    class="bg-primary/15 text-primary text-[10px] font-semibold"
                  >
                    {{ initialsOf(authStore.user?.name ?? "You") }}
                  </AvatarFallback>
                </Avatar>
                <Avatar
                  v-for="row in memberRows.slice(0, 6)"
                  :key="row.user._id"
                  class="size-7 ring-2 ring-background"
                >
                  <AvatarFallback class="text-[10px]">
                    {{ initialsOf(row.user.name) }}
                  </AvatarFallback>
                </Avatar>
                <span
                  v-if="memberRows.length > 6"
                  class="size-7 ring-2 ring-background rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground"
                >
                  +{{ memberRows.length - 6 }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.cp-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
  scrollbar-gutter: stable;
}
.cp-scroll::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.cp-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.cp-scroll::-webkit-scrollbar-thumb {
  background-color: var(--border);
  border-radius: 9999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.cp-scroll::-webkit-scrollbar-thumb:hover {
  background-color: var(--muted-foreground);
}
.cp-scroll::-webkit-scrollbar-corner {
  background: transparent;
}
</style>
