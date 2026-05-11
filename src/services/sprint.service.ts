import api from './api';
import type {
  CreateSprintPayload,
  Sprint,
  SprintReport,
  SprintState,
  UpdateSprintPayload,
} from '@/types';

export async function listSprints(
  projectId: string,
  state?: SprintState,
): Promise<Sprint[]> {
  const params: Record<string, string> = { projectId };
  if (state) params.state = state;
  const { data } = await api.get<{ sprints: Sprint[] }>('/sprints', {
    params,
  });
  return data.sprints;
}

export async function getSprint(id: string): Promise<Sprint> {
  const { data } = await api.get<{ sprint: Sprint }>(`/sprints/${id}`);
  return data.sprint;
}

export async function createSprint(
  payload: CreateSprintPayload,
): Promise<Sprint> {
  const { data } = await api.post<{ sprint: Sprint }>('/sprints', payload);
  return data.sprint;
}

export async function updateSprint(
  id: string,
  payload: UpdateSprintPayload,
): Promise<Sprint> {
  const { data } = await api.patch<{ sprint: Sprint }>(
    `/sprints/${id}`,
    payload,
  );
  return data.sprint;
}

export async function startSprint(id: string): Promise<Sprint> {
  const { data } = await api.post<{ sprint: Sprint }>(`/sprints/${id}/start`);
  return data.sprint;
}

export async function closeSprint(
  id: string,
  rolloverSprintId?: string | null,
): Promise<{ sprint: Sprint; rolledOver: number; completed: number }> {
  const { data } = await api.post<{
    sprint: Sprint;
    rolledOver: number;
    completed: number;
  }>(`/sprints/${id}/close`, { rolloverSprintId: rolloverSprintId ?? null });
  return data;
}

export async function deleteSprint(id: string): Promise<void> {
  await api.delete(`/sprints/${id}`);
}

export async function getSprintReport(id: string): Promise<SprintReport> {
  const { data } = await api.get<SprintReport>(`/sprints/${id}/report`);
  return data;
}
