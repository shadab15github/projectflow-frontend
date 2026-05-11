import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  CreateComponentPayload,
  ProjectComponent,
  UpdateComponentPayload,
} from '@/types';
import * as componentService from '@/services/component.service';

export const useComponentStore = defineStore('component', () => {
  const components = ref<ProjectComponent[]>([]);
  const currentProjectId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function findById(id: string): ProjectComponent | undefined {
    return components.value.find((c) => c._id === id);
  }

  function upsert(component: ProjectComponent): void {
    const idx = components.value.findIndex((c) => c._id === component._id);
    if (idx >= 0) components.value[idx] = component;
    else components.value.unshift(component);
  }

  async function fetchComponents(projectId: string): Promise<void> {
    loading.value = true;
    error.value = null;
    currentProjectId.value = projectId;
    try {
      components.value = await componentService.listComponents(projectId);
    } catch (err) {
      error.value = 'Failed to load components';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createComponent(
    payload: CreateComponentPayload,
  ): Promise<ProjectComponent> {
    const component = await componentService.createComponent(payload);
    upsert(component);
    return component;
  }

  async function updateComponent(
    id: string,
    payload: UpdateComponentPayload,
  ): Promise<ProjectComponent> {
    const component = await componentService.updateComponent(id, payload);
    upsert(component);
    return component;
  }

  async function deleteComponent(id: string): Promise<void> {
    await componentService.deleteComponent(id);
    components.value = components.value.filter((c) => c._id !== id);
  }

  function clear(): void {
    components.value = [];
    currentProjectId.value = null;
    error.value = null;
  }

  return {
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
  };
});
