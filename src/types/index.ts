export type Role = 'super_admin' | 'admin' | 'manager' | 'user';

export type TaskState = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED' | 'CANCELLED';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  _id: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string;
  createdAt: string;
}

export interface Tenant {
  _id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: string;
}

export type ProjectStatus = 'active' | 'archived';

export interface Project {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  members: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  members?: string[];
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  members?: string[];
}

export interface Task {
  _id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description: string;
  state: TaskState;
  priority: TaskPriority;
  assigneeId?: string | null;
  labels: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  projectId: string;
  title: string;
  description?: string;
  state?: TaskState;
  priority?: TaskPriority;
  assigneeId?: string | null;
  labels?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  state?: TaskState;
  priority?: TaskPriority;
  assigneeId?: string | null;
  labels?: string[];
}

export interface TaskListQuery {
  projectId: string;
  state?: TaskState;
  assigneeId?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  orgName: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiError {
  message: string;
  status: number;
}
