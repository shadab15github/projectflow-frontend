<script setup lang="ts">
import { ref, watch } from 'vue';
import axios from 'axios';
import { useProjectStore } from '@/store/project';
import type { Project } from '@/types';
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
  project: Project;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:open': [value: boolean];
  saved: [];
}>();

const projectStore = useProjectStore();

const name = ref<string>('');
const description = ref<string>('');
const formError = ref<string | null>(null);
const fieldError = ref<string | null>(null);
const saving = ref(false);

watch(
  () => props.open,
  (next) => {
    if (next) {
      name.value = props.project.name;
      description.value = props.project.description;
      formError.value = null;
      fieldError.value = null;
      saving.value = false;
    }
  },
);

function setOpen(value: boolean): void {
  emit('update:open', value);
}

async function onSubmit(): Promise<void> {
  fieldError.value = null;
  formError.value = null;

  if (name.value.trim().length < 2) {
    fieldError.value = 'Name must be at least 2 characters';
    return;
  }

  saving.value = true;
  try {
    await projectStore.updateProject(props.project._id, {
      name: name.value.trim(),
      description: description.value.trim(),
    });
    emit('saved');
    emit('update:open', false);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      formError.value =
        (err.response?.data as { message?: string } | undefined)?.message ??
        'Failed to save changes.';
    } else {
      formError.value = 'Unexpected error. Please try again.';
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog :open="props.open" @update:open="setOpen">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Edit project</DialogTitle>
        <DialogDescription>
          Update the project name and description.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="onSubmit" novalidate>
        <div class="flex flex-col gap-2">
          <Label for="edit-project-name">Name</Label>
          <Input
            id="edit-project-name"
            v-model="name"
            :aria-invalid="!!fieldError"
            :disabled="saving"
          />
          <p v-if="fieldError" class="text-sm text-destructive">
            {{ fieldError }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="edit-project-description">Description</Label>
          <Textarea
            id="edit-project-description"
            v-model="description"
            rows="4"
            :disabled="saving"
          />
        </div>

        <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="saving"
            @click="setOpen(false)"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
