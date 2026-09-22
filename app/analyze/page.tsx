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
  const [isGithub, setIsGithub] = useState(false);
  const [githubState, setGithubState] = useState<any>(null);

  useEffect(() => {
    const pid = localStorage.getItem('testguard_active_project_id');
    if (!pid) {
      router.push('/');
      return;
    }
    setProjectId(pid);
    
    // Check if it's a github project (has a / in ID)
    if (pid.includes('/')) {
      setIsGithub(true);
      const stateStr = localStorage.getItem(`testguard_github_state_${pid}`);
      if (stateStr) {
        const state = JSON.parse(stateStr);
        setGithubState(state);
        const diffFiles = state.diffFiles;
        if (diffFiles) {
          // Map GitHub diff files to CodeNode-like structure
          const githubNodes: (CodeNode & { patch?: string })[] = diffFiles.map((f: any) => ({
            id: f.filename,
            type: 'file',
            name: f.filename,
            module: f.filename.split('/')[0] || 'root',
            description: `Status: ${f.status} (+${f.additions} -${f.deletions})`,
            patch: f.patch
          }));
          setNodes(githubNodes);
          setSelectedChanges(githubNodes);
        }
      }
      return;
    }

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
    if (selectedChanges.length === 0 || !projectId) return;
    localStorage.setItem(`testguard_changes_${projectId}`, JSON.stringify(selectedChanges.map(c => c.id)));
    
    // For GitHub projects, store the full node structures so the results page can display them
    if (isGithub) {
       localStorage.setItem(`testguard_github_nodes_${projectId}`, JSON.stringify(selectedChanges));
    }
    
    router.push('/results');
  };

  if (!projectId) return null;

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">{isGithub ? "Review GitHub Changes" : "Analyze Change"}</h1>
      <p className="page-subtitle">
        {isGithub 
          ? "These files were modified in the selected GitHub commit. Review before analysis." 
          : "Select the files or functions you have modified to see impact."}
      </p>

      {isGithub && githubState && (
        <div style={{
          marginBottom: '2rem',
          padding: '1rem',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '0.5rem'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GitCommit className="w-5 h-5 text-blue-400" />
            GitHub Commit Context
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', fontSize: '0.875rem' }}>
            <div style={{ color: '#94a3b8' }}>Repository:</div>
            <div style={{ fontWeight: 500 }}>{githubState.repo?.owner}/{githubState.repo?.repo}</div>
            <div style={{ color: '#94a3b8' }}>Branch:</div>
            <div style={{ fontWeight: 500 }}>{githubState.selectedBranch}</div>
            <div style={{ color: '#94a3b8' }}>Commit:</div>
            <div style={{ fontWeight: 500, fontFamily: 'monospace' }}>{githubState.selectedCommit}</div>
            <div style={{ color: '#94a3b8' }}>Message:</div>
            <div>{githubState.commitData?.message}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>{isGithub ? "Changed Files in Commit" : "Codebase Explorer"}</h3>
          
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search files..." 
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
                <div style={{ maxWidth: '85%' }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span className="badge badge-neutral" style={{ padding: '0.1rem 0.4rem', marginRight: '0.5rem' }}>
                      {node.type}
                    </span>
                    {node.description || `Module: ${node.module}`}
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
            <h3 style={{ fontSize: '1.25rem' }}>Selected Changes</h3>
            <span className="badge badge-neutral">{selectedChanges.length} items</span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {selectedChanges.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>
                <GitCommit className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No changes selected.</p>
                <p style={{ fontSize: '0.875rem' }}>Select items from the list to simulate changes.</p>
              </div>
            ) : (
              selectedChanges.map((node: any) => (
                <div key={`sel-${node.id}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div 
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
                    <div style={{ maxWidth: '85%' }}>
                      <div style={{ fontWeight: 500, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{node.description || `${node.type} • ${node.module}`}</div>
                    </div>
                    <button 
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      onClick={() => removeChange(node.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {isGithub && node.patch && (
                    <div style={{
                      backgroundColor: '#0f172a',
                      border: '1px solid var(--panel-border)',
                      borderRadius: '0.375rem',
                      padding: '0.75rem',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      color: '#cbd5e1'
                    }}>
                      {node.patch.split('\n').map((line: string, i: number) => (
                        <div key={i} style={{ 
                          color: line.startsWith('+') ? '#4ade80' : line.startsWith('-') ? '#f87171' : 'inherit',
                          backgroundColor: line.startsWith('+') ? 'rgba(74, 222, 128, 0.1)' : line.startsWith('-') ? 'rgba(248, 113, 113, 0.1)' : 'transparent',
                          padding: '0 0.25rem'
                        }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
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
