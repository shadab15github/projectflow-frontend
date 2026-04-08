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

export interface Project {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  status: string;
  members: string[];
  createdAt: string;
}

export interface Task {
  _id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description: string;
  state: TaskState;
  priority: TaskPriority;
  assigneeId: string;
  labels: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
