export type BuildPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type BuildStatus = 'DONE' | 'IN_PROGRESS' | 'TODO' | 'RISK' | 'BLOCKED';
export type BuildMaturity = 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5';
export type DataOwnership = 'DB' | 'LOCAL_STORAGE' | 'DERIVED' | 'EXTERNAL' | 'NONE';

export interface BuildDocLink {
  label: string;
  path: string;
}

export interface BuildStatusNode {
  id: string;
  title: string;
  category: string;
  priority: BuildPriority;
  status: BuildStatus;
  maturity: BuildMaturity;
  progress: number;
  productValue: string;
  currentEvidence: string[];
  nextActions: string[];
  backendState: string;
  frontendState: string;
  dataOwnership: DataOwnership;
  risks: string[];
  docLinks: BuildDocLink[];
  children?: BuildStatusNode[];
}

export interface BuildSummaryCard {
  title: string;
  value: string;
  description: string;
  status: BuildStatus;
}

export interface BuildCapability {
  id: string;
  title: string;
  current: string;
  target: string;
  score: number;
}

export interface BuildStatusFilter {
  priority?: BuildPriority | 'ALL';
  status?: BuildStatus | 'ALL';
  maturity?: BuildMaturity | 'ALL';
}
