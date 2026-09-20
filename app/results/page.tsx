"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, AlertTriangle, CheckSquare, Square, Info } from "lucide-react";
import { ReactFlow, Background, Controls, Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnalysisResult, CodeNode } from "@/lib/engine/types";

// Simple hierarchical layout function
function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const nodeIds = nodes.map(n => n.id);
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();

  nodeIds.forEach(id => {
    inDegree.set(id, 0);
    outEdges.set(id, []);
  });

  edges.forEach(e => {
    if (inDegree.has(e.target)) inDegree.set(e.target, inDegree.get(e.target)! + 1);
    if (outEdges.has(e.source)) outEdges.get(e.source)!.push(e.target);
  });

  const layers = new Map<string, number>();
  const queue: { id: string, layer: number }[] = [];
  
  nodeIds.forEach(id => {
    if (inDegree.get(id) === 0) {
      queue.push({ id, layer: 0 });
      layers.set(id, 0);
    }
  });

  let maxLayer = 0;
  while (queue.length > 0) {
    const { id, layer } = queue.shift()!;
    maxLayer = Math.max(maxLayer, layer);
    const neighbors = outEdges.get(id) || [];
    for (const nextId of neighbors) {
      const nextLayer = layer + 1;
      if (!layers.has(nextId) || layers.get(nextId)! < nextLayer) {
        layers.set(nextId, nextLayer);
        queue.push({ id: nextId, layer: nextLayer });
      }
    }
  }

  const layerCounts = new Map<number, number>();
  const layoutedNodes = nodes.map(node => {
    const layer = layers.get(node.id) || 0;
    const indexInLayer = layerCounts.get(layer) || 0;
    layerCounts.set(layer, indexInLayer + 1);
    
    return {
      ...node,
      position: { x: layer * 280, y: indexInLayer * 100 }
    };
  });

  return { nodes: layoutedNodes, edges };
}

export default function Results() {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  
  const [executionRunning, setExecutionRunning] = useState(false);
  const [executionDone, setExecutionDone] = useState(false);

  useEffect(() => {
    const pid = localStorage.getItem('testguard_project');
    const changesJson = localStorage.getItem('testguard_changes');
    const githubStateStr = localStorage.getItem('testguard_github_state');
    
    if (!pid || !changesJson) {
      router.push('/analyze');
      return;
    }
    setProjectId(pid);

    const modifiedNodeIds = JSON.parse(changesJson);
    const githubState = githubStateStr ? JSON.parse(githubStateStr) : undefined;

    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: pid, modifiedNodeIds, githubState })
    })
    .then(async res => {
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to analyze project');
      }
      return res.json();
    })
    .then(data => {
      setResult(data);
      setLoading(false);
      
      const impacted = new Set<string>();
      data.affectedTests.forEach((t: CodeNode) => {
        if (t.priorityLevel !== 'LOW') impacted.add(t.id);
      });
      setSelectedTests(impacted);
      
      if (pid === 'github' && githubStateStr) {
        try {
          const savedStr = localStorage.getItem('testguard_saved_projects');
          if (savedStr) {
            const savedProjects = JSON.parse(savedStr);
            const pId = `${githubState.repo.owner}/${githubState.repo.repo}`;
            const idx = savedProjects.findIndex((p: any) => p.id === pId);
            if (idx >= 0) {
              savedProjects[idx].lastAnalyzed = new Date().toISOString();
              localStorage.setItem('testguard_saved_projects', JSON.stringify(savedProjects));
            }
          }
        } catch (e) {}
      }
    })
    .catch(err => {
      console.error(err);
      alert("Analysis Failed: " + err.message);
      router.push('/analyze');
    });
  }, [router]);

  useEffect(() => {
    if (!result) return;
    
    const affectedIds = new Set<string>();
    result.affectedTests.forEach(t => affectedIds.add(t.id));
    const changesObj = JSON.parse(localStorage.getItem('testguard_changes') || '[]');
    changesObj.forEach((id: string) => affectedIds.add(id));

    result.relevantEdges.forEach(e => {
      if (affectedIds.has(e.source) || affectedIds.has(e.target)) {
        affectedIds.add(e.source);
        affectedIds.add(e.target);
      }
    });

    const rawNodes: Node[] = Array.from(affectedIds).map((id) => {
      let nodeData = result.allNodes.find(n => n.id === id);
      if (!nodeData && projectId === 'github') {
        const ghNodes = JSON.parse(localStorage.getItem('testguard_github_nodes') || '[]');
        nodeData = ghNodes.find((n: any) => n.id === id);
      }
      
      const isChange = changesObj.includes(id);
      const isTest = nodeData?.type === 'test';
      
      let bgColor = '#1e293b';
      let borderColor = '#334155';
      
      if (isChange) {
        bgColor = 'rgba(245, 158, 11, 0.2)';
        borderColor = '#f59e0b';
      } else if (isTest) {
        bgColor = 'rgba(59, 130, 246, 0.2)';
        borderColor = '#3b82f6';
        if (nodeData?.priorityLevel === 'HIGH') {
          bgColor = 'rgba(239, 68, 68, 0.2)';
          borderColor = '#ef4444';
        }
      }

      return {
        id,
        position: { x: 0, y: 0 },
        data: { label: nodeData?.name || id, fullData: nodeData, isChange, isTest },
        style: { background: bgColor, border: `1px solid ${borderColor}`, color: '#f8fafc', borderRadius: '4px', padding: '10px', fontSize: '12px' }
      };
    });

    const rawEdges: Edge[] = result.relevantEdges
      .filter(e => affectedIds.has(e.source) && affectedIds.has(e.target))
      .map((e, i) => ({
        id: `e${i}`,
        source: e.target, 
        target: e.source,
        animated: true,
        style: { stroke: '#64748b' }
      }));

    const layouted = getLayoutedElements(rawNodes, rawEdges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    
  }, [result, projectId]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeData(node.data);
  }, []);

  const handleTestToggle = (id: string) => {
    const newSelected = new Set(selectedTests);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedTests(newSelected);
  };

  const handleSelectMode = (mode: 'full' | 'impacted' | 'critical') => {
    if (!result) return;
    const newSelected = new Set<string>();
    if (mode === 'full') {
      result.affectedTests.forEach(t => newSelected.add(t.id));
    } else if (mode === 'impacted') {
      result.affectedTests.forEach(t => {
        if (t.priorityLevel !== 'LOW') newSelected.add(t.id);
      });
    }
    // Critical mode not fully supported yet in this phase
    setSelectedTests(newSelected);
  };

  const handleRunExecution = () => {
    setExecutionRunning(true);
    setTimeout(() => {
      setExecutionRunning(false);
      setExecutionDone(true);
    }, 1000);
  };

  if (loading || !result) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '1rem', color: '#94a3b8' }}>{projectId === 'github' ? "Downloading repository and running static impact analysis..." : "Analyzing dependency graph and test impact..."}</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const highTests = result.affectedTests.filter(t => t.priorityLevel === 'HIGH');
  const medTests = result.affectedTests.filter(t => t.priorityLevel === 'MEDIUM');
  const lowTests = result.affectedTests.filter(t => t.priorityLevel === 'LOW');
  
  const changedFilesCount = JSON.parse(localStorage.getItem('testguard_changes') || '[]').length;
  const affectedModules = new Set(nodes.filter(n => n.data?.fullData?.type === 'module').map(n => n.id)).size;
  const affectedFuncs = new Set(nodes.filter(n => n.data?.fullData?.type === 'function').map(n => n.id)).size;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Code Change Impact Analysis</h1>
          <p className="page-subtitle">Dependency graph mapping and risk-based test prioritization.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Changed Files</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{changedFilesCount}</div>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Affected Code Nodes</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{affectedModules + affectedFuncs}</div>
        </div>
        <div className="card" style={{ padding: '1rem', borderTop: '3px solid #ef4444' }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>High Impact Tests</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fca5a5' }}>{highTests.length}</div>
        </div>
        <div className="card" style={{ padding: '1rem', borderTop: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Medium Impact Tests</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fcd34d' }}>{medTests.length}</div>
        </div>
        <div className="card" style={{ padding: '1rem', borderTop: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Low / No Detected Impact</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#6ee7b7' }}>{lowTests.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div className="card" style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem' }}>Dependency & Impact Graph</h3>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><div style={{ width: 10, height: 10, backgroundColor: 'rgba(245, 158, 11, 0.5)', border: '1px solid #f59e0b' }} /> Changed Code</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><div style={{ width: 10, height: 10, backgroundColor: '#1e293b', border: '1px solid #334155' }} /> Intermediate Node</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><div style={{ width: 10, height: 10, backgroundColor: 'rgba(59, 130, 246, 0.5)', border: '1px solid #3b82f6' }} /> Test Node</div>
            </div>
          </div>
          <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', overflow: 'hidden' }}>
            <ReactFlow 
              nodes={nodes} 
              edges={edges} 
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              fitView
              attributionPosition="bottom-right"
            >
              <Background color="#334155" />
              <Controls />
            </ReactFlow>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Node Details</h3>
          {!selectedNodeData ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <Info className="w-8 h-8 mb-2 opacity-50" />
              <p style={{ fontSize: '0.875rem' }}>Click a node in the graph to view details.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'white', wordBreak: 'break-all' }}>
                  {selectedNodeData.fullData?.name || selectedNodeData.label}
                </h4>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  {selectedNodeData.fullData?.type ? selectedNodeData.fullData.type.toUpperCase() : 'NODE'} 
                  {selectedNodeData.isChange && <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>(Modified in commit)</span>}
                </div>
              </div>
              
              <div style={{ fontSize: '0.875rem', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0.5rem' }}>
                  <span style={{ color: '#94a3b8' }}>ID:</span>
                  <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{selectedNodeData.fullData?.id || '-'}</span>
                  
                  <span style={{ color: '#94a3b8' }}>Module:</span>
                  <span style={{ wordBreak: 'break-all' }}>{selectedNodeData.fullData?.module || '-'}</span>
                </div>
              </div>

              {selectedNodeData.isTest && selectedNodeData.fullData && (
                <div style={{ marginTop: '0.5rem' }}>
                  <h5 style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Impact & Priority</h5>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className={`badge badge-${selectedNodeData.fullData.priorityLevel.toLowerCase()}`}>
                      {selectedNodeData.fullData.priorityLevel} IMPACT
                    </span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                    {selectedNodeData.fullData.priorityReason}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Test Selection</h3>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              Selected: {selectedTests.size} / {result.affectedTests.length} tests
              ({result.affectedTests.length - selectedTests.size} deferred for this change)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => handleSelectMode('full')}>
              Full Regression
            </button>
            <button className="btn btn-secondary" onClick={() => handleSelectMode('impacted')}>
              Impacted Only
            </button>
            <button className="btn btn-secondary" onClick={() => handleSelectMode('critical')} disabled title="No criticality data available yet">
              Impacted + Critical
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--panel-border)', color: '#94a3b8' }}>
                <th style={{ padding: '0.75rem', width: '40px' }}></th>
                <th style={{ padding: '0.75rem' }}>Test Name</th>
                <th style={{ padding: '0.75rem' }}>Impact Level</th>
                <th style={{ padding: '0.75rem' }}>Reasoning</th>
              </tr>
            </thead>
            <tbody>
              {result.affectedTests.map((test) => {
                const isSelected = selectedTests.has(test.id);
                let badgeClass = "badge-neutral";
                if (test.priorityLevel === 'HIGH') badgeClass = "badge-high";
                if (test.priorityLevel === 'MEDIUM') badgeClass = "badge-medium";
                if (test.priorityLevel === 'LOW') badgeClass = "badge-low";

                return (
                  <tr key={test.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
                    <td style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => handleTestToggle(test.id)}>
                      {isSelected ? <CheckSquare className="w-5 h-5 text-blue-500" /> : <Square className="w-5 h-5 text-slate-500" />}
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{test.name}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge ${badgeClass}`}>{test.priorityLevel}</span>
                    </td>
                    <td style={{ padding: '0.75rem', color: '#94a3b8' }}>
                      {test.priorityReason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid var(--panel-border)', paddingTop: '1.5rem' }}>
          {executionDone ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontWeight: 500 }}>
              <AlertTriangle className="w-5 h-5" /> Phase 4 Actual Pytest Execution Not Yet Implemented
            </div>
          ) : (
            <button className="btn btn-primary" onClick={handleRunExecution} disabled={executionRunning || selectedTests.size === 0}>
              {executionRunning ? (
                <>Preparing Execution...</>
              ) : (
                <><PlayCircle className="w-5 h-5 mr-2" /> Run Selected Tests</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
