"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, AlertTriangle, CheckSquare, Square, Info, CheckCircle2, XCircle, History, Activity } from "lucide-react";
import { clsx } from "clsx";
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
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<'selected' | 'full'>('selected');
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  useEffect(() => {
    const pid = localStorage.getItem('testguard_active_project_id');
    if (!pid) {
      router.push('/');
      return;
    }
    
    const changesJson = localStorage.getItem(`testguard_changes_${pid}`);
    const githubStateStr = localStorage.getItem(`testguard_github_state_${pid}`);
    
    if (!changesJson) {
      router.push('/analyze');
      return;
    }
    setProjectId(pid);

    const histStr = localStorage.getItem(`testguard_execution_history_${pid}`);
    if (histStr) {
      try { setExecutionHistory(JSON.parse(histStr)); } catch(e) {}
    }

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
        if (t.priorityLevel !== 'LOW' && t.priorityLevel !== 'NONE') impacted.add(t.id);
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
    const changesObj = JSON.parse(localStorage.getItem(`testguard_changes_${projectId}`) || '[]');
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
        const ghNodes = JSON.parse(localStorage.getItem(`testguard_github_nodes_${projectId}`) || '[]');
        nodeData = ghNodes.find((n: any) => n.id === id);
      }
      
      const affectedTest = result.affectedTests.find(t => t.id === id);
      if (affectedTest && nodeData) {
        nodeData = {
          ...nodeData,
          priorityLevel: affectedTest.priorityLevel,
          priorityScore: affectedTest.priorityScore,
          priorityReason: affectedTest.priorityReason
        } as any;
      }
      
      const isChange = changesObj.includes(id);
      const isTest = nodeData?.type === 'test';
      
      let bgColor = '#1e293b';
      let borderColor = '#334155';
      
      if (isChange) {
        bgColor = 'rgba(245, 158, 11, 0.2)';
        borderColor = '#f59e0b';
      } else if (isTest) {
        if (nodeData?.priorityLevel === 'HIGH') {
          bgColor = 'rgba(239, 68, 68, 0.2)';
          borderColor = '#ef4444';
        } else if (nodeData?.priorityLevel === 'MEDIUM') {
          bgColor = 'rgba(245, 158, 11, 0.2)';
          borderColor = '#f59e0b';
        } else if (nodeData?.priorityLevel === 'LOW') {
          bgColor = 'rgba(59, 130, 246, 0.2)';
          borderColor = '#3b82f6';
        } else {
          bgColor = '#1e293b';
          borderColor = '#334155';
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
        if (t.priorityLevel !== 'LOW' && t.priorityLevel !== 'NONE') newSelected.add(t.id);
      });
    }
    // Critical mode not fully supported yet in this phase
    setSelectedTests(newSelected);
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear the execution history for this repository?')) {
      setExecutionHistory([]);
      if (projectId) {
        localStorage.removeItem(`testguard_execution_history_${projectId}`);
      }
    }
  };

  const handleRunExecution = async () => {
    setExecutionRunning(true);
    setExecutionError(null);
    setExecutionDone(false);
    
    try {
      const githubStateStr = localStorage.getItem(`testguard_github_state_${projectId}`);
      const githubState = githubStateStr ? JSON.parse(githubStateStr) : undefined;
      
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          githubState,
          selectedTests: Array.from(selectedTests),
          mode: executionMode
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Execution failed');
      }
      
      const newHistoryEntry = {
        id: Date.now().toString(),
        commitSha: (projectId && projectId.includes('/')) ? (githubState?.selectedCommit || 'unknown') : 'demo',
        commitMessage: githubState?.commitData?.message || 'unknown',
        timestamp: new Date().toISOString(),
        mode: executionMode,
        metrics: {
          totalSelected: executionMode === 'full' ? data.results.length : selectedTests.size,
          passed: data.results.filter((t: any) => t.outcome === 'passed').length,
          failed: data.results.filter((t: any) => t.outcome === 'failed').length,
          error: data.results.filter((t: any) => t.outcome === 'error').length,
          durationSec: parseFloat(data.duration)
        },
        results: data.results.map((t: any) => ({ nodeid: t.nodeid, outcome: t.outcome, duration: t.duration }))
      };
      
      const newHistory = [newHistoryEntry, ...executionHistory].slice(0, 20);
      setExecutionHistory(newHistory);
      
      setExecutionResult(data);
      setExecutionDone(true);
      setActiveTab('current');
      if (projectId) {
        localStorage.setItem(`testguard_execution_history_${projectId}`, JSON.stringify(newHistory));
      }
    } catch (err: any) {
      setExecutionError(err.message);
      setExecutionDone(true);
    } finally {
      setExecutionRunning(false);
    }
  };

  if (loading || !result) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '1rem', color: '#94a3b8' }}>{projectId?.includes('/') ? "Downloading repository and running static impact analysis..." : "Analyzing dependency graph and test impact..."}</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const highTests = result.affectedTests.filter(t => t.priorityLevel === 'HIGH');
  const medTests = result.affectedTests.filter(t => t.priorityLevel === 'MEDIUM');
  const lowTests = result.affectedTests.filter(t => t.priorityLevel === 'LOW');
  const noneTests = result.affectedTests.filter(t => t.priorityLevel === 'NONE' || !t.priorityLevel);
  
  const changedFilesCount = JSON.parse(localStorage.getItem(`testguard_changes_${projectId}`) || '[]').length;
  const affectedModules = new Set(nodes.filter(n => (n.data as any)?.fullData?.type === 'module').map(n => n.id)).size;
  const affectedFuncs = new Set(nodes.filter(n => (n.data as any)?.fullData?.type === 'function').map(n => n.id)).size;

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
        <div className="card" style={{ padding: '1rem', borderTop: '3px solid #3b82f6' }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Low Impact Tests</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#93c5fd' }}>{lowTests.length}</div>
        </div>
        <div className="card" style={{ padding: '1rem', borderTop: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>None / No Impact</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#6ee7b7' }}>{noneTests.length}</div>
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
                    {selectedNodeData.fullData.priorityLevel ? (
                      <span className={`badge badge-${selectedNodeData.fullData.priorityLevel.toLowerCase()}`}>
                        {selectedNodeData.fullData.priorityLevel} IMPACT
                      </span>
                    ) : (
                      <span className="badge badge-neutral">UNKNOWN IMPACT</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                    {selectedNodeData.fullData.priorityReason || 'No impact analysis available for this node.'}
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
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'flex', gap: '1rem' }}>
              <span>Total tests: {result.affectedTests.length}</span>
              <span>Selected: {selectedTests.size}</span>
              <span>Deferred: {result.affectedTests.length - selectedTests.size}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => handleSelectMode('full')}>
              Select All Tests
            </button>
            <button className="btn btn-secondary" onClick={() => handleSelectMode('impacted')}>
              Select Impacted Only
            </button>
            <button className="btn btn-secondary" onClick={() => handleSelectMode('critical')} disabled title="No criticality data available yet">
              Select Critical
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

        <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className={clsx("btn", activeTab === 'current' ? "btn-primary" : "btn-secondary")} onClick={() => setActiveTab('current')}>Current Execution</button>
              <button className={clsx("btn", activeTab === 'history' ? "btn-primary" : "btn-secondary")} onClick={() => setActiveTab('history')}>History & Comparison</button>
            </div>
            
            {!executionDone && activeTab === 'current' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select className="btn btn-secondary" value={executionMode} onChange={(e) => setExecutionMode(e.target.value as any)} disabled={executionRunning}>
                  <option value="selected">Run Impacted Tests</option>
                  <option value="full">Run Full Regression</option>
                </select>
                <button className="btn btn-primary" onClick={handleRunExecution} disabled={executionRunning || (executionMode === 'selected' && selectedTests.size === 0)}>
                  {executionRunning ? "Preparing Execution..." : <><PlayCircle className="w-5 h-5 mr-2" /> Run</>}
                </button>
              </div>
            )}
          </div>

          {activeTab === 'current' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {executionDone ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.25rem' }}>Execution Results</h3>
                    <button className="btn btn-secondary" onClick={() => setExecutionDone(false)}>Close Results</button>
                  </div>
                  
                  {executionError ? (
                    <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '0.375rem', color: '#fca5a5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                        <AlertTriangle className="w-5 h-5" /> Execution Error
                      </div>
                      <p>{executionError}</p>
                    </div>
                  ) : executionResult && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', gap: '2rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Selected</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{executionMode === 'full' ? executionResult.results.length : selectedTests.size}</div>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Passed</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#22c55e' }}>
                            {executionResult.results.filter((t: any) => t.outcome === 'passed').length}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Failed</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ef4444' }}>
                            {executionResult.results.filter((t: any) => t.outcome === 'failed').length}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Duration</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{executionResult.duration}s</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {executionResult.results.map((testResult: any, idx: number) => {
                          const isPassed = testResult.outcome === 'passed';
                          return (
                            <div key={idx} style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.02)', border: `1px solid ${isPassed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '0.375rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {isPassed ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                                <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', wordBreak: 'break-all' }}>{testResult.nodeid}</span>
                                <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.75rem' }}>{testResult.duration.toFixed(2)}s</span>
                              </div>
                              {!isPassed && testResult.longrepr && (
                                <pre style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '0.25rem', overflowX: 'auto', fontSize: '0.75rem', color: '#fca5a5' }}>
                                  {testResult.longrepr}
                                </pre>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem' }}>
                  <PlayCircle className="w-12 h-12 mb-4 opacity-50" />
                  <p>Ready to run tests.</p>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Select your execution mode above.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {(() => {
                const currentCommitSha = (projectId && projectId.includes('/')) ? (JSON.parse(localStorage.getItem(`testguard_github_state_${projectId}`) || '{}').selectedCommit || '') : 'demo';
                const currentCommitHistory = executionHistory.filter(h => h.commitSha === currentCommitSha);
                const selectedRun = currentCommitHistory.find(h => h.mode === 'selected');
                const fullRun = currentCommitHistory.find(h => h.mode === 'full');
                const showComparison = selectedRun && fullRun;

                return (
                  <>
                    {showComparison && (
                      <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid #3b82f6', borderRadius: '0.5rem', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Activity className="w-5 h-5" /> Regression Comparison
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1rem' }}>
                          Comparing executions for commit <strong style={{ fontFamily: 'monospace' }}>{currentCommitSha.substring(0, 7)}</strong>
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                          <div>
                            <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>TestGuard Selection</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{selectedRun.metrics.totalSelected} tests</div>
                            <div style={{ fontSize: '1.125rem' }}>{selectedRun.metrics.durationSec.toFixed(2)}s</div>
                            <div style={{ fontSize: '0.875rem', color: '#22c55e' }}>{selectedRun.metrics.passed} Passed, <span style={{ color: selectedRun.metrics.failed > 0 ? '#ef4444' : 'inherit' }}>{selectedRun.metrics.failed} Failed</span></div>
                          </div>
                          <div>
                            <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Full Regression</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{fullRun.metrics.totalSelected} tests</div>
                            <div style={{ fontSize: '1.125rem' }}>{fullRun.metrics.durationSec.toFixed(2)}s</div>
                            <div style={{ fontSize: '0.875rem', color: '#22c55e' }}>{fullRun.metrics.passed} Passed, <span style={{ color: fullRun.metrics.failed > 0 ? '#ef4444' : 'inherit' }}>{fullRun.metrics.failed} Failed</span></div>
                          </div>
                          <div style={{ borderLeft: '1px solid var(--panel-border)', paddingLeft: '1.5rem' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Impact</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f59e0b' }}>
                              {fullRun.metrics.totalSelected - selectedRun.metrics.totalSelected} tests 
                              <span style={{ fontSize: '0.75rem', display: 'block', fontWeight: 400 }}>(Deferred based on TestGuard selection)</span>
                            </div>
                            <div style={{ fontSize: '1.125rem', color: '#f59e0b' }}>
                              {(fullRun.metrics.durationSec - selectedRun.metrics.durationSec).toFixed(2)}s 
                              <span style={{ fontSize: '0.75rem', display: 'block', fontWeight: 400 }}>(Measured Execution Difference)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <History className="w-5 h-5" /> Execution History
                        </h3>
                        {executionHistory.length > 0 && (
                          <button 
                            onClick={handleClearHistory}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer' }}
                          >
                            Clear History
                          </button>
                        )}
                      </div>
                      {executionHistory.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No execution history found for this repository.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {executionHistory.map(run => (
                            <div key={run.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 100px', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '0.375rem', alignItems: 'center', gap: '1rem', fontSize: '0.875rem' }}>
                              <div>
                                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                                  {run.mode === 'full' ? 'Full Regression' : 'Impacted Tests'}
                                  {run.commitSha !== 'demo' && <span style={{ marginLeft: '0.5rem', fontWeight: 400, color: '#94a3b8', fontFamily: 'monospace' }}>{run.commitSha.substring(0, 7)}</span>}
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{new Date(run.timestamp).toLocaleString()}</div>
                              </div>
                              <div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Tests</div>
                                <div style={{ fontWeight: 600 }}>{run.metrics.totalSelected}</div>
                              </div>
                              <div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Passed</div>
                                <div style={{ fontWeight: 600, color: '#22c55e' }}>{run.metrics.passed}</div>
                              </div>
                              <div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Failed</div>
                                <div style={{ fontWeight: 600, color: run.metrics.failed > 0 ? '#ef4444' : 'inherit' }}>{run.metrics.failed}</div>
                              </div>
                              <div>
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Duration</div>
                                <div style={{ fontWeight: 600 }}>{run.metrics.durationSec.toFixed(2)}s</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
