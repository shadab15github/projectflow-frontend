<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import { storeToRefs } from 'pinia';
import { VsxIcon } from 'vue-iconsax';
import { useComponentStore } from '@/store/component';
import * as userService from '@/services/user.service';
import type { ProjectComponent, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectContext } from './projectContext';

const { project, canEdit } = useProjectContext();
const componentStore = useComponentStore();
const { components } = storeToRefs(componentStore);

const projectId = computed<string>(() => project.value?._id ?? '');

const tenantUsers = ref<User[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const dialogOpen = ref(false);
const editingId = ref<string | null>(null);
const submitting = ref(false);
const formError = ref<string | null>(null);

const NONE = '__none__';
const form = ref({
  name: '',
  description: '',
  leadId: NONE,
  defaultAssigneeId: NONE,
});

const memberUsers = computed<User[]>(() => {
  if (!project.value) return [];
  const memberIds = new Set(project.value.members.map((m) => m.userId));
  return tenantUsers.value.filter((u) => memberIds.has(u._id));
});

const userById = computed<Map<string, User>>(() => {
  const map = new Map<string, User>();
  for (const u of tenantUsers.value) map.set(u._id, u);
  return map;
});

async function load(): Promise<void> {
  if (!projectId.value) return;
  loading.value = true;
  error.value = null;
  try {
    await Promise.all([
      componentStore.fetchComponents(projectId.value),
      loadUsers(),
    ]);
  } catch (err) {
    error.value =
      axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ??
          'Failed to load components.'
        : 'Failed to load components.';
  } finally {
    loading.value = false;
  }
}

async function loadUsers(): Promise<void> {
  try {
    tenantUsers.value = await userService.listUsers();
  } catch {
    tenantUsers.value = [];
  }
}

onMounted(load);
watch(projectId, load);

function openDialog(component?: ProjectComponent): void {
  if (component) {
    editingId.value = component._id;
    form.value = {
      name: component.name,
      description: component.description,
      leadId: component.leadId ?? NONE,
      defaultAssigneeId: component.defaultAssigneeId ?? NONE,
    };
  } else {
    editingId.value = null;
    form.value = {
      name: '',
      description: '',
      leadId: NONE,
      defaultAssigneeId: NONE,
    };
  }
  formError.value = null;
  dialogOpen.value = true;
}

function extractMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (
      (err.response?.data as { message?: string } | undefined)?.message ??
      fallback
    );
  }
  return fallback;
}

async function submit(): Promise<void> {
  if (form.value.name.trim().length < 1) {
    formError.value = 'Name is required';
    return;
  }
  submitting.value = true;
  formError.value = null;
  try {
    const payload = {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      leadId: form.value.leadId === NONE ? null : form.value.leadId,
      defaultAssigneeId:
        form.value.defaultAssigneeId === NONE
          ? null
          : form.value.defaultAssigneeId,
    };
    if (editingId.value) {
      await componentStore.updateComponent(editingId.value, payload);
    } else {
      await componentStore.createComponent({
        projectId: projectId.value,
        ...payload,
      });
    }
    dialogOpen.value = false;
  } catch (err) {
    formError.value = extractMessage(err, 'Failed to save component.');
  } finally {
    submitting.value = false;
  }
}

async function remove(component: ProjectComponent): Promise<void> {
  const confirmed = window.confirm(
    `Delete component "${component.name}"? Items linked to it will be detached.`,
  );
  if (!confirmed) return;
  try {
    await componentStore.deleteComponent(component._id);
  } catch (err) {
    error.value = extractMessage(err, 'Failed to delete component.');
  }
}

function initialsOf(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">Components</h2>
        <p class="text-sm text-muted-foreground">
          Group work by feature, area, or service. Define components once and
          tag them on any item.
        </p>
      </div>
      <Button
        v-if="canEdit"
        size="sm"
        class="gap-1.5"
        @click="openDialog()"
      >
        <VsxIcon iconName="Add" class="size-4" /> New component
      </Button>
    </div>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <p v-if="loading" class="text-sm text-muted-foreground">Loading…</p>

    <div
      v-else-if="components.length === 0"
      class="rounded-lg border border-dashed p-12 text-center"
    >
      <VsxIcon
        iconName="Diagram"
        class="size-8 mx-auto text-muted-foreground"
      />
      <p class="mt-3 text-sm font-medium">No components yet</p>
      <p class="text-xs text-muted-foreground mt-1">
        Components let you tag items by feature area or owning sub-team.
      </p>
      <Button
        v-if="canEdit"
        class="mt-4 gap-1.5"
        size="sm"
        @click="openDialog()"
      >
        <VsxIcon iconName="Add" class="size-4" /> Create component
      </Button>
    </div>

    <div v-else class="rounded-lg border bg-card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-muted/40 text-muted-foreground">
          <tr>
            <th class="text-left font-medium px-4 py-2">Name</th>
            <th class="text-left font-medium px-4 py-2">Description</th>
            <th class="text-left font-medium px-4 py-2">Lead</th>
            <th class="text-left font-medium px-4 py-2">Default assignee</th>
            <th class="text-right font-medium px-4 py-2 w-20"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in components"
            :key="c._id"
            class="border-t hover:bg-accent/20"
          >
            <td class="px-4 py-3 font-medium">{{ c.name }}</td>
            <td class="px-4 py-3 text-muted-foreground max-w-xs truncate">
              {{ c.description || '—' }}
            </td>
            <td class="px-4 py-3">
              <div v-if="c.leadId" class="flex items-center gap-2">
                <Avatar class="size-6">
                  <AvatarFallback class="text-[10px]">
                    {{ initialsOf(userById.get(c.leadId)?.name) }}
                  </AvatarFallback>
                </Avatar>
                <span class="text-xs">{{
                  userById.get(c.leadId)?.name ?? 'Unknown'
                }}</span>
              </div>
              <span v-else class="text-xs text-muted-foreground">—</span>
            </td>
            <td class="px-4 py-3">
              <div v-if="c.defaultAssigneeId" class="flex items-center gap-2">
                <Avatar class="size-6">
                  <AvatarFallback class="text-[10px]">
                    {{ initialsOf(userById.get(c.defaultAssigneeId)?.name) }}
                  </AvatarFallback>
                </Avatar>
                <span class="text-xs">{{
                  userById.get(c.defaultAssigneeId)?.name ?? 'Unknown'
                }}</span>
              </div>
              <span v-else class="text-xs text-muted-foreground">—</span>
            </td>
            <td class="px-4 py-3 text-right">
              <div v-if="canEdit" class="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit"
                  @click="openDialog(c)"
                >
                  <VsxIcon iconName="Edit" class="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete"
                  @click="remove(c)"
                >
                  <VsxIcon iconName="Trash" class="size-3.5" />
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {{ editingId ? 'Edit component' : 'New component' }}
          </DialogTitle>
          <DialogDescription>
            Components are project-specific and can have a lead and a default
            assignee.
          </DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submit">
          <div class="flex flex-col gap-1.5">
            <Label for="comp-name">Name</Label>
            <Input
              id="comp-name"
              v-model="form.name"
              placeholder="Authentication"
              :disabled="submitting"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="comp-desc">Description</Label>
            <Textarea
              id="comp-desc"
              v-model="form.description"
              rows="3"
              :disabled="submitting"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Component lead</Label>
            <Select v-model="form.leadId" :disabled="submitting">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NONE">
                  <span class="text-muted-foreground">No lead</span>
                </SelectItem>
                <SelectItem
                  v-for="u in memberUsers"
                  :key="u._id"
                  :value="u._id"
                >
                  {{ u.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Default assignee</Label>
            <Select v-model="form.defaultAssigneeId" :disabled="submitting">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NONE">
                  <span class="text-muted-foreground">None</span>
                </SelectItem>
                <SelectItem
                  v-for="u in memberUsers"
                  :key="u._id"
                  :value="u._id"
                >
                  {{ u.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p v-if="formError" class="text-sm text-destructive">
            {{ formError }}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="submitting"
              @click="dialogOpen = false"
            >
              Cancel
            </Button>
            <Button type="submit" :disabled="submitting">
              {{ submitting ? 'Saving…' : 'Save' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
