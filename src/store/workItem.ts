import { computed, reactive, ref } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type {
  CreateWorkItemPayload,
  UpdateWorkItemPayload,
  WorkItem,
  WorkItemListQuery,
  WorkItemListResult,
  WorkItemState,
  WorkItemType,
} from '@/types';
import * as workItemService from '@/services/workItem.service';

export const workItemKeys = {
  all: ['workItems'] as const,
  lists: () => [...workItemKeys.all, 'list'] as const,
  list: (query: WorkItemListQuery) =>
    [...workItemKeys.lists(), query] as const,
  details: () => [...workItemKeys.all, 'detail'] as const,
  detail: (id: string) => [...workItemKeys.details(), id] as const,
  mine: () => [...workItemKeys.all, 'mine'] as const,
};

// Module-scoped state — shared across every component that calls
// useWorkItemStore(). Without this, each consumer would get its own
// empty `items` ref and tabs like Board/Backlog/Summary would never
// see data fetched by the parent page.
const currentItem = ref<WorkItem | null>(null);
const currentProjectId = ref<string | null>(null);
const lastQuery = ref<WorkItemListQuery | null>(null);
const stateFilter = ref<WorkItemState | null>(null);
const typeFilter = ref<WorkItemType | null>(null);
const items = ref<WorkItem[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(25);
const loading = ref(false);
const error = ref<string | null>(null);

/**
 * Composable for the work-item slice. Mirrors the previous Pinia store API,
 * backed by TanStack Query. Local UI state (state/type filters, current item,
 * pagination cursors) remains in plain refs since it is not server-derived.
 */
export function useWorkItemStore() {
  const qc = useQueryClient();

  const segments = computed<WorkItem[]>(() =>
    items.value.filter((i) => i.type === 'segment'),
  );
  const tasks = computed<WorkItem[]>(() =>
    items.value.filter((i) => i.type === 'task'),
  );
  const subtasks = computed<WorkItem[]>(() =>
    items.value.filter((i) => i.type === 'subtask'),
  );

  const filteredItems = computed<WorkItem[]>(() => {
    let result = items.value;
    if (stateFilter.value)
      result = result.filter((i) => i.state === stateFilter.value);
    if (typeFilter.value)
      result = result.filter((i) => i.type === typeFilter.value);
    return result;
  });

  const itemsByState = computed<Record<WorkItemState, WorkItem[]>>(() => {
    const groups: Record<WorkItemState, WorkItem[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
      BLOCKED: [],
      CANCELLED: [],
    };
    for (const item of filteredItems.value) groups[item.state].push(item);
    return groups;
  });

  function findById(id: string): WorkItem | undefined {
    return items.value.find((i) => i._id === id);
  }

  function childrenOf(parentId: string): WorkItem[] {
    return items.value.filter((i) => i.parentId === parentId);
  }

  function upsert(item: WorkItem): void {
    const idx = items.value.findIndex((i) => i._id === item._id);
    if (idx >= 0) items.value[idx] = item;
    else items.value.unshift(item);
  }

  function invalidateLists(projectId: string | null): void {
    void qc.invalidateQueries({ queryKey: workItemKeys.lists() });
    if (projectId) {
      // also drop the "my tasks" query
      void qc.invalidateQueries({ queryKey: workItemKeys.mine() });
    }
  }

  async function fetchItems(query: WorkItemListQuery): Promise<void> {
    loading.value = true;
    error.value = null;
    currentProjectId.value = query.projectId;
    const effective: WorkItemListQuery = {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 200,
    };
    lastQuery.value = effective;
    try {
      const result = await qc.fetchQuery<WorkItemListResult>({
        queryKey: workItemKeys.list(effective),
        queryFn: () => workItemService.listWorkItems(effective),
      });
      items.value = result.items;
      total.value = result.total;
      page.value = result.page;
      limit.value = result.limit;
    } catch (err) {
      error.value = 'Failed to load work items';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchItem(id: string): Promise<WorkItem> {
    loading.value = true;
    error.value = null;
    try {
      const item = await qc.fetchQuery<WorkItem>({
        queryKey: workItemKeys.detail(id),
        queryFn: () => workItemService.getWorkItem(id),
      });
      currentItem.value = item;
      upsert(item);
      return item;
    } catch (err) {
      error.value = 'Failed to load work item';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateWorkItemPayload) =>
      workItemService.createWorkItem(payload),
    onSuccess: (item) => {
      upsert(item);
      qc.setQueryData(workItemKeys.detail(item._id), item);
      invalidateLists(item.projectId);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateWorkItemPayload;
    }) => workItemService.updateWorkItem(id, payload),
    onSuccess: (item) => {
      upsert(item);
      if (currentItem.value?._id === item._id) currentItem.value = item;
      qc.setQueryData(workItemKeys.detail(item._id), item);
      invalidateLists(item.projectId);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workItemService.deleteWorkItem(id),
    onSuccess: (_void, id) => {
      items.value = items.value.filter((i) => i._id !== id);
      if (currentItem.value?._id === id) currentItem.value = null;
      qc.removeQueries({ queryKey: workItemKeys.detail(id) });
      invalidateLists(currentProjectId.value);
    },
  });

  async function createItem(
    payload: CreateWorkItemPayload,
  ): Promise<WorkItem> {
    return await createMutation.mutateAsync(payload);
  }

  async function updateItem(
    id: string,
    payload: UpdateWorkItemPayload,
  ): Promise<WorkItem> {
    return await updateMutation.mutateAsync({ id, payload });
  }

  async function deleteItem(id: string): Promise<void> {
    await deleteMutation.mutateAsync(id);
  }

  function setStateFilter(state: WorkItemState | null): void {
    stateFilter.value = state;
  }

  function setTypeFilter(type: WorkItemType | null): void {
    typeFilter.value = type;
  }

  function clear(): void {
    items.value = [];
    currentItem.value = null;
    currentProjectId.value = null;
    lastQuery.value = null;
    stateFilter.value = null;
    typeFilter.value = null;
    error.value = null;
    total.value = 0;
    page.value = 1;
    limit.value = 25;
  }

  return reactive({
    items,
    currentItem,
    currentProjectId,
    stateFilter,
    typeFilter,
    loading,
    error,
    total,
    page,
    limit,
    segments,
    tasks,
    subtasks,
    filteredItems,
    itemsByState,
    findById,
    childrenOf,
    fetchItems,
    fetchItem,
    createItem,
    updateItem,
    deleteItem,
    setStateFilter,
    setTypeFilter,
    clear,
  });
}
