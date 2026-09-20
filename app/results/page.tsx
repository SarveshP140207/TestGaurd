"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { ReactFlow, Background, Controls, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnalysisResult, CodeNode } from "@/lib/engine/types";

export default function Results() {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulation, setSimulation] = useState<{ running: boolean; results: Record<string, 'passed'|'failed'> | null }>({ running: false, results: null });

  useEffect(() => {
    const pid = localStorage.getItem('testguard_project');
    const changesJson = localStorage.getItem('testguard_changes');
    
    if (!pid || !changesJson) {
      router.push('/analyze');
      return;
    }

    const modifiedNodeIds = JSON.parse(changesJson);

    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: pid, modifiedNodeIds })
    })
    .then(res => res.json())
    .then(data => {
      setResult(data);
      setLoading(false);
    });
  }, [router]);

  const handleRunSimulation = () => {
    setSimulation({ running: true, results: null });
    
    // Simulate test execution delay
    setTimeout(() => {
      if (!result) return;
      const simResults: Record<string, 'passed'|'failed'> = {};
      result.affectedTests.forEach(t => {
        // High priority (flaky or directly affected) have higher chance to fail in simulation
        if (t.priorityLevel === 'HIGH') simResults[t.id] = Math.random() > 0.4 ? 'failed' : 'passed';
        else if (t.priorityLevel === 'MEDIUM') simResults[t.id] = Math.random() > 0.8 ? 'failed' : 'passed';
        else simResults[t.id] = 'passed';
      });
      setSimulation({ running: false, results: simResults });
    }, 2000);
  };

  if (loading || !result) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Analyzing dependency graph and test impact...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const highTests = result.affectedTests.filter(t => t.priorityLevel === 'HIGH');
  const medTests = result.affectedTests.filter(t => t.priorityLevel === 'MEDIUM');
  const lowTests = result.affectedTests.filter(t => t.priorityLevel === 'LOW');

  // Prepare graph data
  const affectedIds = new Set<string>();
  result.affectedTests.forEach(t => affectedIds.add(t.id));
  const changesObj = JSON.parse(localStorage.getItem('testguard_changes') || '[]');
  changesObj.forEach((id: string) => affectedIds.add(id));

  // Find intermediate nodes
  result.relevantEdges.forEach(e => {
    if (affectedIds.has(e.source) || affectedIds.has(e.target)) {
      affectedIds.add(e.source);
      affectedIds.add(e.target);
    }
  });

  const graphNodes: Node[] = Array.from(affectedIds).map((id, index) => {
    const nodeData = result.allNodes.find(n => n.id === id);
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
      position: { x: (index % 4) * 200, y: Math.floor(index / 4) * 100 },
      data: { label: nodeData?.name || id },
      style: { background: bgColor, border: `1px solid ${borderColor}`, color: '#f8fafc', borderRadius: '4px', padding: '10px' }
    };
  });

  const graphEdges: Edge[] = result.relevantEdges
    .filter(e => affectedIds.has(e.source) && affectedIds.has(e.target))
    .map((e, i) => ({
      id: `e${i}`,
      source: e.target, // Reverse direction to show impact flow: Modified -> Function -> Test
      target: e.source,
      animated: true,
      style: { stroke: '#64748b' }
    }));

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title">Prioritization Results</h1>
          <p className="page-subtitle">Affected tests ranked by risk and dependency proximity.</p>
        </div>
        <button className="btn btn-primary" onClick={handleRunSimulation} disabled={simulation.running}>
          <PlayCircle className="w-5 h-5" /> 
          {simulation.running ? "Running..." : "Run Prioritized Tests (Sim)"}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ borderTop: '4px solid #ef4444' }}>
          <h3 style={{ fontSize: '1rem', color: '#94a3b8' }}>HIGH PRIORITY</h3>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: '#fca5a5' }}>{highTests.length}</p>
        </div>
        <div className="card" style={{ borderTop: '4px solid #f59e0b' }}>
          <h3 style={{ fontSize: '1rem', color: '#94a3b8' }}>MEDIUM PRIORITY</h3>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: '#fcd34d' }}>{medTests.length}</p>
        </div>
        <div className="card" style={{ borderTop: '4px solid #10b981' }}>
          <h3 style={{ fontSize: '1rem', color: '#94a3b8' }}>LOW PRIORITY</h3>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: '#6ee7b7' }}>{lowTests.length}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        <div className="card" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Impact Graph (Modified → Tests)</h3>
          <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem' }}>
            <ReactFlow nodes={graphNodes} edges={graphEdges} fitView>
              <Background color="#334155" />
              <Controls />
            </ReactFlow>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Prioritized Test List</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--panel-border)', color: '#94a3b8' }}>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>ID</th>
                  <th style={{ padding: '0.75rem' }}>Test Name</th>
                  <th style={{ padding: '0.75rem' }}>Module</th>
                  <th style={{ padding: '0.75rem' }}>Score</th>
                  <th style={{ padding: '0.75rem' }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {result.affectedTests.map((test) => {
                  let badgeClass = "badge-neutral";
                  if (test.priorityLevel === 'HIGH') badgeClass = "badge-high";
                  if (test.priorityLevel === 'MEDIUM') badgeClass = "badge-medium";
                  if (test.priorityLevel === 'LOW') badgeClass = "badge-low";

                  let simIcon = null;
                  if (simulation.results && simulation.results[test.id]) {
                    const status = simulation.results[test.id];
                    simIcon = status === 'passed' ? 
                      <CheckCircle className="w-5 h-5 text-emerald-500" /> : 
                      <XCircle className="w-5 h-5 text-red-500" />;
                  } else if (simulation.running) {
                    simIcon = <Clock className="w-5 h-5 text-slate-400" />;
                  }

                  return (
                    <tr key={test.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem' }}>{simIcon || "-"}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 500 }}>{test.id}</td>
                      <td style={{ padding: '0.75rem' }}>{test.name}</td>
                      <td style={{ padding: '0.75rem', color: '#94a3b8' }}>{test.module}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={`badge ${badgeClass}`}>{test.priorityScore}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                        {test.priorityReason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
