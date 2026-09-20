"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, ArrowRight, GitCommit } from "lucide-react";
import { CodeNode } from "@/lib/engine/types";

export default function AnalyzeChange() {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<CodeNode[]>([]);
  const [selectedChanges, setSelectedChanges] = useState<CodeNode[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const pid = localStorage.getItem('testguard_project');
    if (!pid) {
      router.push('/import');
      return;
    }
    setProjectId(pid);
    
    fetch(`/api/projects/${pid}`)
      .then(res => res.json())
      .then(data => {
        // Only allow selecting source files/functions, not tests
        setNodes(data.nodes.filter((n: CodeNode) => n.type !== 'test'));
        
        // Auto-select the first function for the demo scenario
        if (pid === 'ecommerce-demo') {
          const fn = data.nodes.find((n: CodeNode) => n.id === 'fn_calc_payment');
          if (fn) setSelectedChanges([fn]);
        } else {
          const firstFn = data.nodes.find((n: CodeNode) => n.type === 'function');
          if (firstFn) setSelectedChanges([firstFn]);
        }
      });
  }, [router]);

  const filteredNodes = nodes.filter(n => 
    n.name.toLowerCase().includes(search.toLowerCase()) || 
    n.module?.toLowerCase().includes(search.toLowerCase())
  );

  const addChange = (node: CodeNode) => {
    if (!selectedChanges.find(c => c.id === node.id)) {
      setSelectedChanges([...selectedChanges, node]);
    }
  };

  const removeChange = (id: string) => {
    setSelectedChanges(selectedChanges.filter(c => c.id !== id));
  };

  const handleAnalyze = () => {
    if (selectedChanges.length === 0) return;
    localStorage.setItem('testguard_changes', JSON.stringify(selectedChanges.map(c => c.id)));
    router.push('/results');
  };

  if (!projectId) return null;

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Analyze Change</h1>
      <p className="page-subtitle">Select the files or functions you have modified to see impact.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Codebase Explorer</h3>
          
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search files, functions, or modules..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.5rem 1rem 0.5rem 2.5rem', 
                backgroundColor: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--panel-border)',
                borderRadius: '0.375rem',
                color: 'white',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredNodes.map(node => (
              <div 
                key={node.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--panel-border)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{node.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span className="badge badge-neutral" style={{ padding: '0.1rem 0.4rem', marginRight: '0.5rem' }}>
                      {node.type}
                    </span>
                    Module: {node.module}
                  </div>
                </div>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '0.25rem' }}
                  onClick={() => addChange(node)}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem' }}>Selected Changes (What-If)</h3>
            <span className="badge badge-neutral">{selectedChanges.length} items</span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {selectedChanges.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>
                <GitCommit className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No changes selected.</p>
                <p style={{ fontSize: '0.875rem' }}>Select items from the codebase explorer to simulate changes.</p>
              </div>
            ) : (
              selectedChanges.map(node => (
                <div 
                  key={`sel-${node.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '0.375rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: '#60a5fa' }}>{node.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{node.type} • {node.module}</div>
                  </div>
                  <button 
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    onClick={() => removeChange(node.id)}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--panel-border)' }}>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '0.75rem' }}
              onClick={handleAnalyze}
              disabled={selectedChanges.length === 0}
            >
              Analyze Impact <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
