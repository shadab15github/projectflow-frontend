<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import axios from 'axios';
import { useTaskStore } from '@/store/task';
import type { TaskPriority, TaskState } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface Props {
  open: boolean;
  projectId: string;
  projectMembers: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:open': [value: boolean];
  created: [taskId: string];
}>();

const taskStore = useTaskStore();

const STATES: { value: TaskState; label: string }[] = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'DONE', label: 'Done' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

interface FieldErrors {
  title?: string;
  assigneeId?: string;
}

interface FormState {
  title: string;
  description: string;
  state: TaskState;
  priority: TaskPriority;
  assigneeId: string;
  labels: string;
}

const form = reactive<FormState>({
  title: '',
  description: '',
  state: 'TODO',
  priority: 'medium',
  assigneeId: '',
  labels: '',
});
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
  form.title = '';
  form.description = '';
  form.state = 'TODO';
  form.priority = 'medium';
  form.assigneeId = '';
  form.labels = '';
  fieldErrors.title = undefined;
  fieldErrors.assigneeId = undefined;
  formError.value = null;
  submitting.value = false;
}

function parseLabels(): string[] {
  return form.labels
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function validate(): boolean {
  fieldErrors.title = undefined;
  fieldErrors.assigneeId = undefined;
  let ok = true;

  if (form.title.trim().length < 2) {
    fieldErrors.title = 'Title must be at least 2 characters';
    ok = false;
  }

  if (form.assigneeId && !/^[a-f\d]{24}$/i.test(form.assigneeId)) {
    fieldErrors.assigneeId = 'Assignee must be a valid user id';
    ok = false;
  }

  return ok;
}

async function onSubmit(): Promise<void> {
  formError.value = null;
  if (!validate()) return;

  submitting.value = true;
  try {
    const task = await taskStore.createTask({
      projectId: props.projectId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      state: form.state,
      priority: form.priority,
      assigneeId: form.assigneeId || null,
      labels: parseLabels(),
    });
    emit('created', task._id);
    emit('update:open', false);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const message = (err.response?.data as { message?: string } | undefined)
        ?.message;
      formError.value = message ?? 'Failed to create task. Please try again.';
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
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Create task</DialogTitle>
        <DialogDescription>
          Add a new task to this project.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="onSubmit" novalidate>
        <div class="flex flex-col gap-2">
          <Label for="task-title">Title</Label>
          <Input
            id="task-title"
            v-model="form.title"
            placeholder="Implement login form"
            :aria-invalid="!!fieldErrors.title"
            :disabled="submitting"
          />
          <p v-if="fieldErrors.title" class="text-sm text-destructive">
            {{ fieldErrors.title }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="task-description">Description</Label>
          <Textarea
            id="task-description"
            v-model="form.description"
            placeholder="What needs to happen?"
            rows="3"
            :disabled="submitting"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <Label>State</Label>
            <Select v-model="form.state" :disabled="submitting">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in STATES"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex flex-col gap-2">
            <Label>Priority</Label>
            <Select v-model="form.priority" :disabled="submitting">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in PRIORITIES"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <Label>Assignee</Label>
          <Select
            v-if="props.projectMembers.length > 0"
            v-model="form.assigneeId"
            :disabled="submitting"
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="memberId in props.projectMembers"
                :key="memberId"
                :value="memberId"
              >
                <span class="font-mono text-xs">{{ memberId }}</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-else
            id="task-assignee"
            v-model="form.assigneeId"
            placeholder="User id (optional)"
            :aria-invalid="!!fieldErrors.assigneeId"
            :disabled="submitting"
          />
          <p v-if="fieldErrors.assigneeId" class="text-sm text-destructive">
            {{ fieldErrors.assigneeId }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="task-labels">Labels</Label>
          <Input
            id="task-labels"
            v-model="form.labels"
            placeholder="Comma-separated (optional)"
            :disabled="submitting"
          />
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
            {{ submitting ? 'Creating…' : 'Create task' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
