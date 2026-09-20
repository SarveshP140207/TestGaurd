import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DependencyGraph } from '@/lib/engine/DependencyGraph';
import { calculateTestPriorities } from '@/lib/engine/Prioritization';
import { ProjectData, CodeNode, AnalysisResult } from '@/lib/engine/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, modifiedNodeIds } = body;

    if (!projectId || !modifiedNodeIds || !Array.isArray(modifiedNodeIds)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (projectId === 'github') {
      return NextResponse.json({
        modifiedNodeId: modifiedNodeIds[0] || 'github_commit',
        affectedTests: [],
        allNodes: [],
        relevantEdges: []
      });
    }

    const filePath = path.join(process.cwd(), 'data', `${projectId}.json`);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectData: ProjectData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // 1. Build Graph
    const graph = new DependencyGraph(projectData.nodes, projectData.edges);
    
    // 2. Calculate impact distances
    const distances = graph.calculateImpactPaths(modifiedNodeIds);
    
    // 3. Filter tests
    const allTests = projectData.nodes.filter(n => n.type === 'test');
    
    // 4. Prioritize tests
    const prioritizedTests = calculateTestPriorities(allTests, distances);

    // Filter relevant edges for visualization (edges connecting modified -> affected -> tests)
    // For prototype simplicity, we return all edges, the frontend can filter or show all.
    const result: AnalysisResult = {
      modifiedNodeId: modifiedNodeIds[0], // simplified for main visualization
      affectedTests: prioritizedTests,
      allNodes: projectData.nodes,
      relevantEdges: projectData.edges
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
