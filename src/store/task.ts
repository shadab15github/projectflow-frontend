import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  CreateTaskPayload,
  Task,
  TaskListQuery,
  TaskState,
  UpdateTaskPayload,
} from '@/types';
import * as taskService from '@/services/task.service';

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([]);
  const currentTask = ref<Task | null>(null);
  const currentProjectId = ref<string | null>(null);
  const stateFilter = ref<TaskState | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const filteredTasks = computed<Task[]>(() => {
    if (!stateFilter.value) return tasks.value;
    return tasks.value.filter((t) => t.state === stateFilter.value);
  });

  const tasksByState = computed<Record<TaskState, Task[]>>(() => {
    const groups: Record<TaskState, Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
      BLOCKED: [],
      CANCELLED: [],
    };
    for (const task of filteredTasks.value) {
      groups[task.state].push(task);
    }
    return groups;
  });

  function findById(id: string): Task | undefined {
    return tasks.value.find((t) => t._id === id);
  }

  function upsert(task: Task): void {
    const index = tasks.value.findIndex((t) => t._id === task._id);
    if (index >= 0) tasks.value[index] = task;
    else tasks.value.unshift(task);
  }

  async function fetchTasks(query: TaskListQuery): Promise<void> {
    loading.value = true;
    error.value = null;
    currentProjectId.value = query.projectId;
    try {
      tasks.value = await taskService.listTasks(query);
    } catch (err) {
      error.value = 'Failed to load tasks';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTask(id: string): Promise<Task> {
    loading.value = true;
    error.value = null;
    try {
      const task = await taskService.getTask(id);
      currentTask.value = task;
      upsert(task);
      return task;
    } catch (err) {
      error.value = 'Failed to load task';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createTask(payload: CreateTaskPayload): Promise<Task> {
    const task = await taskService.createTask(payload);
    upsert(task);
    return task;
  }

  async function updateTask(
    id: string,
    payload: UpdateTaskPayload,
  ): Promise<Task> {
    const task = await taskService.updateTask(id, payload);
    upsert(task);
    if (currentTask.value?._id === id) currentTask.value = task;
    return task;
  }

  async function deleteTask(id: string): Promise<void> {
    await taskService.deleteTask(id);
    tasks.value = tasks.value.filter((t) => t._id !== id);
    if (currentTask.value?._id === id) currentTask.value = null;
  }

  function setStateFilter(state: TaskState | null): void {
    stateFilter.value = state;
  }

  function clear(): void {
    tasks.value = [];
    currentTask.value = null;
    currentProjectId.value = null;
    stateFilter.value = null;
    error.value = null;
  }

  return {
    tasks,
    currentTask,
    currentProjectId,
    stateFilter,
    loading,
    error,
    filteredTasks,
    tasksByState,
    findById,
    fetchTasks,
    fetchTask,
    createTask,
    updateTask,
    deleteTask,
    setStateFilter,
    clear,
  };
});
