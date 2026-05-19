import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query';
import type {
  CreateProjectPayload,
  Project,
  UpdateProjectPayload,
} from '@/types';
import * as projectService from '@/services/project.service';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: () => [...projectKeys.lists()] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (idOrSlug: string) => [...projectKeys.details(), idOrSlug] as const,
};

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: projectKeys.list(),
    queryFn: projectService.listProjects,
  });
}

export function useRecentProjects(limit = 5) {
  return useQuery<Project[], Error, Project[]>({
    queryKey: projectKeys.list(),
    queryFn: projectService.listProjects,
    select: (projects) =>
      [...projects]
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, limit),
  });
}

export function useProject(idOrSlug: MaybeRefOrGetter<string | undefined | null>) {
  const key = computed(() => toValue(idOrSlug) ?? '');
  return useQuery<Project>({
    queryKey: computed(() => projectKeys.detail(key.value)),
    queryFn: () => projectService.getProject(key.value),
    enabled: computed(() => key.value.length > 0),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation<Project, Error, CreateProjectPayload>({
    mutationFn: projectService.createProject,
    onSuccess: (project) => {
      qc.setQueryData<Project[]>(projectKeys.list(), (prev) =>
        prev ? [project, ...prev.filter((p) => p._id !== project._id)] : [project],
      );
      qc.setQueryData(projectKeys.detail(project._id), project);
      qc.setQueryData(projectKeys.detail(project.slug), project);
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation<
    Project,
    Error,
    { id: string; payload: UpdateProjectPayload }
  >({
    mutationFn: ({ id, payload }) => projectService.updateProject(id, payload),
    onSuccess: (project) => {
      qc.setQueryData<Project[]>(projectKeys.list(), (prev) =>
        prev?.map((p) => (p._id === project._id ? project : p)),
      );
      qc.setQueryData(projectKeys.detail(project._id), project);
      qc.setQueryData(projectKeys.detail(project.slug), project);
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => projectService.deleteProject(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<Project[]>(projectKeys.list(), (prev) =>
        prev?.filter((p) => p._id !== id),
      );
      qc.removeQueries({ queryKey: projectKeys.detail(id) });
    },
  });
}
