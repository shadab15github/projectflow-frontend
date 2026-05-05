<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import axios from 'axios';
import { useProjectStore } from '@/store/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:open': [value: boolean];
  created: [projectSlug: string];
}>();

const projectStore = useProjectStore();

interface FieldErrors {
  name?: string;
  members?: string;
}

const form = reactive({ name: '', description: '', members: '' });
const fieldErrors = reactive<FieldErrors>({});
const formError = ref<string | null>(null);
const submitting = ref(false);

watch(
  () => props.open,
  (next) => {
    if (next) reset();
  },
);

function reset(): void {
  form.name = '';
  form.description = '';
  form.members = '';
  fieldErrors.name = undefined;
  fieldErrors.members = undefined;
  formError.value = null;
  submitting.value = false;
}

function parseMembers(): string[] {
  return form.members
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function validate(): boolean {
  fieldErrors.name = undefined;
  fieldErrors.members = undefined;
  let ok = true;

  if (form.name.trim().length < 2) {
    fieldErrors.name = 'Name must be at least 2 characters';
    ok = false;
  }

  const memberIds = parseMembers();
  if (memberIds.some((id) => !/^[a-f\d]{24}$/i.test(id))) {
    fieldErrors.members = 'Each member must be a valid user id';
    ok = false;
  }

  return ok;
}

async function onSubmit(): Promise<void> {
  formError.value = null;
  if (!validate()) return;

  submitting.value = true;
  try {
    const project = await projectStore.createProject({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      members: parseMembers(),
    });
    emit('created', project.slug);
    emit('update:open', false);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const message = (err.response?.data as { message?: string } | undefined)
        ?.message;
      formError.value = message ?? 'Failed to create project. Please try again.';
    } else {
      formError.value = 'Unexpected error. Please try again.';
    }
  } finally {
    submitting.value = false;
  }
}

function setOpen(value: boolean): void {
  emit('update:open', value);
}
</script>

<template>
  <Dialog :open="props.open" @update:open="setOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create project</DialogTitle>
        <DialogDescription>
          Give your project a name and an optional description.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="onSubmit" novalidate>
        <div class="flex flex-col gap-2">
          <Label for="project-name">Name</Label>
          <Input
            id="project-name"
            v-model="form.name"
            placeholder="Acme website redesign"
            :aria-invalid="!!fieldErrors.name"
            :disabled="submitting"
          />
          <p v-if="fieldErrors.name" class="text-sm text-destructive">
            {{ fieldErrors.name }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="project-description">Description</Label>
          <Textarea
            id="project-description"
            v-model="form.description"
            placeholder="What is this project about?"
            :disabled="submitting"
            rows="3"
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="project-members">Initial members</Label>
          <Input
            id="project-members"
            v-model="form.members"
            placeholder="Comma-separated user IDs (optional)"
            :aria-invalid="!!fieldErrors.members"
            :disabled="submitting"
          />
          <p class="text-xs text-muted-foreground">
            You're added automatically. Leave blank to start solo.
          </p>
          <p v-if="fieldErrors.members" class="text-sm text-destructive">
            {{ fieldErrors.members }}
          </p>
        </div>

        <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="submitting"
            @click="setOpen(false)"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="submitting">
            {{ submitting ? 'Creating…' : 'Create project' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
