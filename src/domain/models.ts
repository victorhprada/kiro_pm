/**
 * Core domain models for Azure DevOps Work Items Creator
 */

// --- Configuration ---

export interface AppConfig {
  organizationUrl: string; // https://dev.azure.com/{org}
  pat: string; // Personal Access Token
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// --- Work Item Hierarchy ---

export interface WorkItemHierarchy {
  epic: EpicData;
  feature: FeatureData;
  userStories: UserStoryData[];
}

export interface EpicData {
  title: string;
  description: string; // HTML formatted
  areaPath: string;
}

export interface FeatureData {
  title: string;
  description: string; // HTML formatted
  areaPath: string;
}

export interface UserStoryData {
  title: string;
  description: string; // HTML formatted
  acceptanceCriteria: string; // HTML formatted
  areaPath: string;
}

// --- Azure DevOps Entities ---

export interface Project {
  id: string;
  name: string;
  description?: string;
}

export interface Team {
  id: string;
  name: string;
  projectId: string;
}

export interface Sprint {
  id: string;
  name: string;
  path: string; // Iteration path completo
  startDate?: Date;
  endDate?: Date;
  status: 'past' | 'current' | 'future';
}

// --- Execution Contexts ---

export interface ConnectionContext {
  organizationUrl: string;
  isConnected: boolean;
  projects: Project[];
}

export interface TargetContext {
  project: Project;
  team: Team;
  sprint: Sprint;
  areaPath: string;
  iterationPath: string;
}

export interface CreationResult {
  success: boolean;
  workItems: WorkItemResult[];
  errors: CreationError[];
}

export interface WorkItemResult {
  id: number;
  url: string;
  type: string;
  title: string;
}

export interface CreationError {
  workItemType: string;
  title: string;
  error: string;
}

export interface ApprovalResult {
  approved: boolean;
  feedback?: string;
  addMoreStories?: boolean;
}
