import api from './api';
import type {
  CreateWorkItemPayload,
  UpdateWorkItemPayload,
  WorkItem,
  WorkItemListQuery,
} from '@/types';

export async function listWorkItems(
  query: WorkItemListQuery,
): Promise<WorkItem[]> {
  const params: Record<string, string> = { projectId: query.projectId };
  if (query.type) params.type = query.type;
  if (query.state) params.state = query.state;
  if (query.assigneeId) params.assigneeId = query.assigneeId;
  if (query.sprintId) params.sprintId = query.sprintId;
  if (query.parentId) params.parentId = query.parentId;

  const { data } = await api.get<{ items: WorkItem[] }>('/work-items', {
    params,
  });
  return data.items;
}

export async function listMine(): Promise<WorkItem[]> {
  const { data } = await api.get<{ items: WorkItem[] }>('/work-items/mine');
  return data.items;
}

export async function getWorkItem(id: string): Promise<WorkItem> {
  const { data } = await api.get<{ item: WorkItem }>(`/work-items/${id}`);
  return data.item;
}

export async function createWorkItem(
  payload: CreateWorkItemPayload,
): Promise<WorkItem> {
  const { data } = await api.post<{ item: WorkItem }>('/work-items', payload);
  return data.item;
}

export async function updateWorkItem(
  id: string,
  payload: UpdateWorkItemPayload,
): Promise<WorkItem> {
  const { data } = await api.patch<{ item: WorkItem }>(
    `/work-items/${id}`,
    payload,
  );
  return data.item;
}

export async function deleteWorkItem(id: string): Promise<void> {
  await api.delete(`/work-items/${id}`);
}
