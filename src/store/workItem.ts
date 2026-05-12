import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  CreateWorkItemPayload,
  UpdateWorkItemPayload,
  WorkItem,
  WorkItemListQuery,
  WorkItemState,
  WorkItemType,
} from '@/types';
import * as workItemService from '@/services/workItem.service';

export const useWorkItemStore = defineStore('workItem', () => {
  const items = ref<WorkItem[]>([]);
  const currentItem = ref<WorkItem | null>(null);
  const currentProjectId = ref<string | null>(null);
  const stateFilter = ref<WorkItemState | null>(null);
  const typeFilter = ref<WorkItemType | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const total = ref(0);
  const page = ref(1);
  const limit = ref(25);

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
    if (stateFilter.value) {
      result = result.filter((i) => i.state === stateFilter.value);
    }
    if (typeFilter.value) {
      result = result.filter((i) => i.type === typeFilter.value);
    }
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

  async function fetchItems(query: WorkItemListQuery): Promise<void> {
    loading.value = true;
    error.value = null;
    currentProjectId.value = query.projectId;
    // Non-paginated callers (Board, Backlog, etc.) get a high default limit
    // so they still receive the full set. List view passes explicit page/limit.
    const effective: WorkItemListQuery = {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 200,
    };
    try {
      const result = await workItemService.listWorkItems(effective);
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
      const item = await workItemService.getWorkItem(id);
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

  async function createItem(
    payload: CreateWorkItemPayload,
  ): Promise<WorkItem> {
    const item = await workItemService.createWorkItem(payload);
    upsert(item);
    return item;
  }

  async function updateItem(
    id: string,
    payload: UpdateWorkItemPayload,
  ): Promise<WorkItem> {
    const item = await workItemService.updateWorkItem(id, payload);
    upsert(item);
    if (currentItem.value?._id === id) currentItem.value = item;
    return item;
  }

  async function deleteItem(id: string): Promise<void> {
    await workItemService.deleteWorkItem(id);
    items.value = items.value.filter((i) => i._id !== id);
    if (currentItem.value?._id === id) currentItem.value = null;
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
    stateFilter.value = null;
    typeFilter.value = null;
    error.value = null;
    total.value = 0;
    page.value = 1;
    limit.value = 25;
  }

  return {
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
  };
});
