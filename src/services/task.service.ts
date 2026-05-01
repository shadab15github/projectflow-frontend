import api from './api';
import type {
  CreateTaskPayload,
  Task,
  TaskListQuery,
  UpdateTaskPayload,
} from '@/types';

export async function listTasks(query: TaskListQuery): Promise<Task[]> {
  const params: Record<string, string> = { projectId: query.projectId };
  if (query.state) params.state = query.state;
  if (query.assigneeId) params.assigneeId = query.assigneeId;

  const { data } = await api.get<{ tasks: Task[] }>('/tasks', { params });
  return data.tasks;
}

export async function getTask(id: string): Promise<Task> {
  const { data } = await api.get<{ task: Task }>(`/tasks/${id}`);
  return data.task;
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const { data } = await api.post<{ task: Task }>('/tasks', payload);
  return data.task;
}

export async function updateTask(
  id: string,
  payload: UpdateTaskPayload,
): Promise<Task> {
  const { data } = await api.patch<{ task: Task }>(`/tasks/${id}`, payload);
  return data.task;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}
