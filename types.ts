export interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface Edge {
  source: string;
  target: string;
  path?: string;
}

export interface MapDefinition {
  nodes: Node[];
  edges: Edge[];
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
  adjacencyList: Record<string, string[]>;
}

export type ColorMapping = Record<string, number | null>;

export type Step = {
  type: 'TRY' | 'SUCCESS' | 'BACKTRACK';
  nodeId: string;
  mapping: ColorMapping;
};