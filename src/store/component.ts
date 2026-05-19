import { computed, reactive, ref } from 'vue';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query';
import type {
  CreateComponentPayload,
  ProjectComponent,
  UpdateComponentPayload,
} from '@/types';
import * as componentService from '@/services/component.service';

export const componentKeys = {
  all: ['components'] as const,
  lists: () => [...componentKeys.all, 'list'] as const,
  list: (projectId: string) => [...componentKeys.lists(), projectId] as const,
};

/**
 * Composable for the component slice. Mirrors the previous Pinia store API,
 * backed by TanStack Query.
 */
export function useComponentStore() {
  const qc = useQueryClient();
  const currentProjectId = ref<string | null>(null);

  const componentsQuery = useQuery<ProjectComponent[]>({
    queryKey: computed(() =>
      componentKeys.list(currentProjectId.value ?? ''),
    ),
    queryFn: () => componentService.listComponents(currentProjectId.value!),
    enabled: computed(() => Boolean(currentProjectId.value)),
  });

  const components = computed<ProjectComponent[]>(
    () => componentsQuery.data.value ?? [],
  );
  const loading = computed<boolean>(() => componentsQuery.isPending.value);
  const error = computed<string | null>(() =>
    componentsQuery.isError.value ? 'Failed to load components' : null,
  );

  function findById(id: string): ProjectComponent | undefined {
    return components.value.find((c) => c._id === id);
  }

  async function fetchComponents(projectId: string): Promise<void> {
    currentProjectId.value = projectId;
    await qc.ensureQueryData({
      queryKey: componentKeys.list(projectId),
      queryFn: () => componentService.listComponents(projectId),
    });
  }

  function invalidate(projectId: string | null): void {
    if (!projectId) return;
    void qc.invalidateQueries({ queryKey: componentKeys.list(projectId) });
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateComponentPayload) =>
      componentService.createComponent(payload),
    onSuccess: (component) => invalidate(component.projectId),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateComponentPayload;
    }) => componentService.updateComponent(id, payload),
    onSuccess: (component) => invalidate(component.projectId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => componentService.deleteComponent(id),
    onSuccess: () => invalidate(currentProjectId.value),
  });

  async function createComponent(
    payload: CreateComponentPayload,
  ): Promise<ProjectComponent> {
    return await createMutation.mutateAsync(payload);
  }

  async function updateComponent(
    id: string,
    payload: UpdateComponentPayload,
  ): Promise<ProjectComponent> {
    return await updateMutation.mutateAsync({ id, payload });
  }

  async function deleteComponent(id: string): Promise<void> {
    await deleteMutation.mutateAsync(id);
  }

  function clear(): void {
    currentProjectId.value = null;
  }

  return reactive({
    components,
    currentProjectId,
    loading,
    error,
    findById,
    fetchComponents,
    createComponent,
    updateComponent,
    deleteComponent,
    clear,
  });
}
