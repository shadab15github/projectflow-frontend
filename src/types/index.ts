export type Role = 'super_admin' | 'admin' | 'manager' | 'user';

export type WorkItemType = 'segment' | 'task' | 'subtask';

export type WorkItemState =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE'
  | 'BLOCKED'
  | 'CANCELLED';

export type WorkItemPriority = 'low' | 'medium' | 'high' | 'urgent';

export type SprintState = 'planned' | 'active' | 'closed';

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

export type ProjectTemplate = 'board' | 'list';

export type ProjectManagement = 'team-managed' | 'company-managed';

export type ProjectAccess = 'open' | 'private';

export type ProjectMemberRole = 'administrator' | 'member' | 'viewer';

export interface ProjectMember {
  userId: string;
  role: ProjectMemberRole;
}

export interface Project {
  _id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  template: ProjectTemplate;
  key: string;
  management: ProjectManagement;
  access: ProjectAccess;
  members: ProjectMember[];
  nextWorkItemNumber: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  template?: ProjectTemplate;
  key: string;
  management?: ProjectManagement;
  access?: ProjectAccess;
  members?: ProjectMember[];
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  template?: ProjectTemplate;
  key?: string;
  management?: ProjectManagement;
  access?: ProjectAccess;
  members?: ProjectMember[];
}

export interface WorkItemAttachment {
  name: string;
  url: string;
  publicId?: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
}

export interface WorkItem {
  _id: string;
  tenantId: string;
  projectId: string;
  type: WorkItemType;
  parentId: string | null;
  number: number;
  key: string;
  title: string;
  description: string;
  state: WorkItemState;
  priority: WorkItemPriority;
  assigneeId: string | null;
  reporterId: string;
  labels: string[];
  componentIds: string[];
  sprintId: string | null;
  storyPoints: number | null;
  dueDate: string | null;
  attachments: WorkItemAttachment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkItemPayload {
  projectId: string;
  type: WorkItemType;
  parentId?: string | null;
  title: string;
  description?: string;
  state?: WorkItemState;
  priority?: WorkItemPriority;
  assigneeId?: string | null;
  reporterId?: string | null;
  labels?: string[];
  componentIds?: string[];
  sprintId?: string | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  attachments?: Omit<WorkItemAttachment, 'uploadedAt'>[];
}

export interface UpdateWorkItemPayload {
  title?: string;
  description?: string;
  state?: WorkItemState;
  priority?: WorkItemPriority;
  assigneeId?: string | null;
  reporterId?: string | null;
  labels?: string[];
  componentIds?: string[];
  sprintId?: string | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  parentId?: string | null;
  attachments?: Omit<WorkItemAttachment, 'uploadedAt'>[];
}

export interface WorkItemListQuery {
  projectId: string;
  type?: WorkItemType;
  state?: WorkItemState;
  assigneeId?: string;
  sprintId?: string | 'none';
  parentId?: string | 'none';
}

export interface Sprint {
  _id: string;
  tenantId: string;
  projectId: string;
  name: string;
  goal: string;
  state: SprintState;
  startDate: string | null;
  endDate: string | null;
  startedAt: string | null;
  closedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSprintPayload {
  projectId: string;
  name: string;
  goal?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateSprintPayload {
  name?: string;
  goal?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface SprintReport {
  sprint: Sprint;
  completed: { count: number; storyPoints: number };
  incomplete: { count: number; storyPoints: number };
  cancelled: { count: number; storyPoints: number };
  total: { count: number; storyPoints: number };
  items: {
    completed: string[];
    incomplete: string[];
    cancelled: string[];
  };
}

export interface ProjectComponent {
  _id: string;
  tenantId: string;
  projectId: string;
  name: string;
  description: string;
  leadId: string | null;
  defaultAssigneeId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComponentPayload {
  projectId: string;
  name: string;
  description?: string;
  leadId?: string | null;
  defaultAssigneeId?: string | null;
}

export interface UpdateComponentPayload {
  name?: string;
  description?: string;
  leadId?: string | null;
  defaultAssigneeId?: string | null;
}

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  bytes: number;
  resource_type: string;
  format: string;
  original_filename: string;
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
