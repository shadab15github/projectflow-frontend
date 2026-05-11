import api from './api';
import type {
  CreateComponentPayload,
  ProjectComponent,
  UpdateComponentPayload,
} from '@/types';

export async function listComponents(
  projectId: string,
): Promise<ProjectComponent[]> {
  const { data } = await api.get<{ components: ProjectComponent[] }>(
    '/components',
    { params: { projectId } },
  );
  return data.components;
}

export async function getComponent(id: string): Promise<ProjectComponent> {
  const { data } = await api.get<{ component: ProjectComponent }>(
    `/components/${id}`,
  );
  return data.component;
}

export async function createComponent(
  payload: CreateComponentPayload,
): Promise<ProjectComponent> {
  const { data } = await api.post<{ component: ProjectComponent }>(
    '/components',
    payload,
  );
  return data.component;
}

export async function updateComponent(
  id: string,
  payload: UpdateComponentPayload,
): Promise<ProjectComponent> {
  const { data } = await api.patch<{ component: ProjectComponent }>(
    `/components/${id}`,
    payload,
  );
  return data.component;
}

export async function deleteComponent(id: string): Promise<void> {
  await api.delete(`/components/${id}`);
}
