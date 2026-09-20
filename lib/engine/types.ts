export type NodeType = 'file' | 'function' | 'test' | 'module';
export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface CodeNode {
  id: string;
  type: NodeType;
  name: string;
  module?: string;
  description?: string;
  historyFailures?: number;
  executionTimeMs?: number;
  priorityScore?: number;
  priorityLevel?: PriorityLevel;
  priorityReason?: string;
}

export interface Edge {
  source: string;
  target: string;
  type: 'imports' | 'calls' | 'covers' | 'contains';
}

export interface ProjectData {
  projectName: string;
  languages: string[];
  nodes: CodeNode[];
  edges: Edge[];
}

export interface AnalysisResult {
  modifiedNodeId: string;
  affectedTests: CodeNode[];
  allNodes: CodeNode[];
  relevantEdges: Edge[];
}
