import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { Project } from '@/types';

export interface ProjectContext {
  project: Ref<Project | null>;
  loading: Ref<boolean>;
  tasksLoading: Ref<boolean>;
  tasksError: Ref<string | null>;
  canEdit: ComputedRef<boolean>;
  canCreateTask: ComputedRef<boolean>;
  canDelete: ComputedRef<boolean>;
  reload: () => Promise<void>;
  reloadTasks: () => Promise<void>;
  openCreateTask: () => void;
}

export const projectContextKey: InjectionKey<ProjectContext> =
  Symbol('projectContext');

export function useProjectContext(): ProjectContext {
  const ctx = inject(projectContextKey);
  if (!ctx) {
    throw new Error('useProjectContext must be used inside ProjectDetailPage');
  }
  return ctx;
}
