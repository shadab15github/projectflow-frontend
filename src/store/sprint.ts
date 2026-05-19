import { computed, reactive, ref } from 'vue';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query';
import type {
  CreateSprintPayload,
  Sprint,
  SprintReport,
  UpdateSprintPayload,
} from '@/types';
import * as sprintService from '@/services/sprint.service';

export const sprintKeys = {
  all: ['sprints'] as const,
  lists: () => [...sprintKeys.all, 'list'] as const,
  list: (projectId: string) => [...sprintKeys.lists(), projectId] as const,
  reports: () => [...sprintKeys.all, 'report'] as const,
  report: (id: string) => [...sprintKeys.reports(), id] as const,
};

/**
 * Composable that exposes the sprint slice. Returns a reactive object
 * whose API mirrors the previous Pinia store so call sites don't need
 * to change. Network calls are routed through TanStack Query so caching,
 * invalidation, and refetching are handled centrally.
 */
export function useSprintStore() {
  const qc = useQueryClient();
  const currentProjectId = ref<string | null>(null);

  const sprintsQuery = useQuery<Sprint[]>({
    queryKey: computed(() =>
      sprintKeys.list(currentProjectId.value ?? ''),
    ),
    queryFn: () => sprintService.listSprints(currentProjectId.value!),
    enabled: computed(() => Boolean(currentProjectId.value)),
  });

  const sprints = computed<Sprint[]>(() => sprintsQuery.data.value ?? []);
  const loading = computed<boolean>(() => sprintsQuery.isPending.value);
  const error = computed<string | null>(() =>
    sprintsQuery.isError.value ? 'Failed to load sprints' : null,
  );

  const activeSprint = computed<Sprint | null>(
    () => sprints.value.find((s) => s.state === 'active') ?? null,
  );
  const plannedSprints = computed<Sprint[]>(() =>
    sprints.value.filter((s) => s.state === 'planned'),
  );
  const closedSprints = computed<Sprint[]>(() =>
    sprints.value.filter((s) => s.state === 'closed'),
  );

  function findById(id: string): Sprint | undefined {
    return sprints.value.find((s) => s._id === id);
  }

  async function fetchSprints(projectId: string): Promise<void> {
    currentProjectId.value = projectId;
    await qc.ensureQueryData({
      queryKey: sprintKeys.list(projectId),
      queryFn: () => sprintService.listSprints(projectId),
    });
  }

  function invalidate(projectId: string | null): void {
    if (!projectId) return;
    void qc.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
  }

  const createSprintMutation = useMutation({
    mutationFn: (payload: CreateSprintPayload) =>
      sprintService.createSprint(payload),
    onSuccess: (sprint) => invalidate(sprint.projectId),
  });

  const updateSprintMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSprintPayload }) =>
      sprintService.updateSprint(id, payload),
    onSuccess: (sprint) => invalidate(sprint.projectId),
  });

  const startSprintMutation = useMutation({
    mutationFn: (id: string) => sprintService.startSprint(id),
    onSuccess: (sprint) => invalidate(sprint.projectId),
  });

  const closeSprintMutation = useMutation({
    mutationFn: ({
      id,
      rolloverSprintId,
    }: {
      id: string;
      rolloverSprintId?: string | null;
    }) => sprintService.closeSprint(id, rolloverSprintId),
    onSuccess: (result) => invalidate(result.sprint.projectId),
  });

  const deleteSprintMutation = useMutation({
    mutationFn: (id: string) => sprintService.deleteSprint(id),
    onSuccess: () => invalidate(currentProjectId.value),
  });

  async function createSprint(payload: CreateSprintPayload): Promise<Sprint> {
    return await createSprintMutation.mutateAsync(payload);
  }

  async function updateSprint(
    id: string,
    payload: UpdateSprintPayload,
  ): Promise<Sprint> {
    return await updateSprintMutation.mutateAsync({ id, payload });
  }

  async function startSprint(id: string): Promise<Sprint> {
    return await startSprintMutation.mutateAsync(id);
  }

  async function closeSprint(
    id: string,
    rolloverSprintId?: string | null,
  ): Promise<{ sprint: Sprint; rolledOver: number; completed: number }> {
    return await closeSprintMutation.mutateAsync({ id, rolloverSprintId });
  }

  async function deleteSprint(id: string): Promise<void> {
    await deleteSprintMutation.mutateAsync(id);
  }

  async function fetchReport(id: string): Promise<SprintReport> {
    return await qc.ensureQueryData({
      queryKey: sprintKeys.report(id),
      queryFn: () => sprintService.getSprintReport(id),
    });
  }

  function clear(): void {
    currentProjectId.value = null;
  }

  return reactive({
    sprints,
    currentProjectId,
    loading,
    error,
    activeSprint,
    plannedSprints,
    closedSprints,
    findById,
    fetchSprints,
    createSprint,
    updateSprint,
    startSprint,
    closeSprint,
    deleteSprint,
    fetchReport,
    clear,
  });
}
