import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  CreateProjectPayload,
  Project,
  UpdateProjectPayload,
} from '@/types';
import * as projectService from '@/services/project.service';

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([]);
  const currentProject = ref<Project | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const recentProjects = computed<Project[]>(() =>
    [...projects.value]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 5),
  );

  function findById(id: string): Project | undefined {
    return projects.value.find((p) => p._id === id);
  }

  function upsert(project: Project): void {
    const index = projects.value.findIndex((p) => p._id === project._id);
    if (index >= 0) projects.value[index] = project;
    else projects.value.unshift(project);
  }

  async function fetchProjects(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      projects.value = await projectService.listProjects();
    } catch (err) {
      error.value = 'Failed to load projects';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchProject(id: string): Promise<Project> {
    loading.value = true;
    error.value = null;
    try {
      const project = await projectService.getProject(id);
      currentProject.value = project;
      upsert(project);
      return project;
    } catch (err) {
      error.value = 'Failed to load project';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createProject(payload: CreateProjectPayload): Promise<Project> {
    const project = await projectService.createProject(payload);
    upsert(project);
    return project;
  }

  async function updateProject(
    id: string,
    payload: UpdateProjectPayload,
  ): Promise<Project> {
    const project = await projectService.updateProject(id, payload);
    upsert(project);
    if (currentProject.value?._id === id) currentProject.value = project;
    return project;
  }

  async function deleteProject(id: string): Promise<void> {
    await projectService.deleteProject(id);
    projects.value = projects.value.filter((p) => p._id !== id);
    if (currentProject.value?._id === id) currentProject.value = null;
  }

  function clear(): void {
    projects.value = [];
    currentProject.value = null;
    error.value = null;
  }

  return {
    projects,
    currentProject,
    loading,
    error,
    recentProjects,
    findById,
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    clear,
  };
});
