import api from './api';
import type {
  CreateProjectPayload,
  Project,
  UpdateProjectPayload,
} from '@/types';

export async function listProjects(): Promise<Project[]> {
  const { data } = await api.get<{ projects: Project[] }>('/projects');
  return data.projects;
}

export async function getProject(id: string): Promise<Project> {
  const { data } = await api.get<{ project: Project }>(`/projects/${id}`);
  return data.project;
}

export async function createProject(
  payload: CreateProjectPayload,
): Promise<Project> {
  const { data } = await api.post<{ project: Project }>('/projects', payload);
  return data.project;
}

export async function updateProject(
  id: string,
  payload: UpdateProjectPayload,
): Promise<Project> {
  const { data } = await api.patch<{ project: Project }>(
    `/projects/${id}`,
    payload,
  );
  return data.project;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}
