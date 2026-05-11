import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  CreateSprintPayload,
  Sprint,
  SprintReport,
  UpdateSprintPayload,
} from '@/types';
import * as sprintService from '@/services/sprint.service';

export const useSprintStore = defineStore('sprint', () => {
  const sprints = ref<Sprint[]>([]);
  const currentProjectId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

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

  function upsert(sprint: Sprint): void {
    const idx = sprints.value.findIndex((s) => s._id === sprint._id);
    if (idx >= 0) sprints.value[idx] = sprint;
    else sprints.value.unshift(sprint);
  }

  async function fetchSprints(projectId: string): Promise<void> {
    loading.value = true;
    error.value = null;
    currentProjectId.value = projectId;
    try {
      sprints.value = await sprintService.listSprints(projectId);
    } catch (err) {
      error.value = 'Failed to load sprints';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createSprint(payload: CreateSprintPayload): Promise<Sprint> {
    const sprint = await sprintService.createSprint(payload);
    upsert(sprint);
    return sprint;
  }

  async function updateSprint(
    id: string,
    payload: UpdateSprintPayload,
  ): Promise<Sprint> {
    const sprint = await sprintService.updateSprint(id, payload);
    upsert(sprint);
    return sprint;
  }

  async function startSprint(id: string): Promise<Sprint> {
    const sprint = await sprintService.startSprint(id);
    upsert(sprint);
    return sprint;
  }

  async function closeSprint(
    id: string,
    rolloverSprintId?: string | null,
  ): Promise<{ sprint: Sprint; rolledOver: number; completed: number }> {
    const result = await sprintService.closeSprint(id, rolloverSprintId);
    upsert(result.sprint);
    return result;
  }

  async function deleteSprint(id: string): Promise<void> {
    await sprintService.deleteSprint(id);
    sprints.value = sprints.value.filter((s) => s._id !== id);
  }

  async function fetchReport(id: string): Promise<SprintReport> {
    return await sprintService.getSprintReport(id);
  }

  function clear(): void {
    sprints.value = [];
    currentProjectId.value = null;
    error.value = null;
  }

  return {
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
  };
});
