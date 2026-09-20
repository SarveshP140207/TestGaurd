import { CodeNode, Edge } from "./types";

export class DependencyGraph {
  nodes: Map<string, CodeNode> = new Map();
  // adjacency list: node -> array of nodes that depend on it
  // If A calls B, B is a dependency of A. So if B changes, A is affected.
  // We need edges in the direction of impact: Changed -> Affected
  impactEdges: Map<string, string[]> = new Map();
  
  constructor(nodes: CodeNode[], edges: Edge[]) {
    nodes.forEach(n => this.nodes.set(n.id, n));
    edges.forEach(e => {
      // In our data: e.source covers/calls/imports e.target
      // If target changes, source is affected.
      // So the impact flows from target -> source
      const impactSource = e.target;
      const impactTarget = e.source;
      
      if (!this.impactEdges.has(impactSource)) {
        this.impactEdges.set(impactSource, []);
      }
      this.impactEdges.get(impactSource)!.push(impactTarget);
    });
  }

  // Returns distances from starting nodes to all reachable nodes
  // distance = number of hops
  calculateImpactPaths(modifiedNodeIds: string[]): Map<string, number> {
    const distances = new Map<string, number>();
    const queue: { id: string, dist: number }[] = [];

    for (const id of modifiedNodeIds) {
      if (this.nodes.has(id)) {
        distances.set(id, 0);
        queue.push({ id, dist: 0 });
      }
    }

    while (queue.length > 0) {
      const { id, dist } = queue.shift()!;
      const affected = this.impactEdges.get(id) || [];
      
      for (const affectedId of affected) {
        if (!distances.has(affectedId) || distances.get(affectedId)! > dist + 1) {
          distances.set(affectedId, dist + 1);
          queue.push({ id: affectedId, dist: dist + 1 });
        }
      }
    }

    return distances;
  }
}
