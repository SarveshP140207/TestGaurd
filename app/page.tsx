"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Folder, RefreshCw, ChevronRight, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface SavedProject {
  id: string;
  url: string;
  repo: any;
  branches: string[];
  selectedBranch: string;
  selectedCommit: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeProject, setActiveProject] = useState<SavedProject | null>(null);
  
  const [commits, setCommits] = useState<any[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [commitError, setCommitError] = useState("");

  useEffect(() => {
    setMounted(true);
    
    const loadActiveProject = () => {
      const activeId = localStorage.getItem('testguard_active_project_id');
      if (activeId) {
        const pData = localStorage.getItem('testguard_saved_projects');
        if (pData) {
          try {
            const projects = JSON.parse(pData);
            const active = projects.find((p: any) => p.id === activeId);
            if (active) {
              setActiveProject(active);
              // Fetch fresh commits on load
              fetchCommits(active.repo.owner, active.repo.repo, active.selectedBranch);
            } else {
              setActiveProject(null);
            }
          } catch(e) {}
        }
      } else {
        setActiveProject(null);
      }
    };
    
    loadActiveProject();
    
    // Listen for storage changes in case sidebar switches project
    const handleStorage = () => {
      const activeId = localStorage.getItem('testguard_active_project_id');
      if (activeProject && activeProject.id !== activeId) {
         loadActiveProject();
      } else if (!activeProject && activeId) {
         loadActiveProject();
      }
    };
    
    window.addEventListener('storage', handleStorage);
    // lightweight polling
    const interval = setInterval(handleStorage, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [activeProject?.id]);

  const fetchCommits = async (owner: string, repo: string, branch: string) => {
    setLoadingCommits(true);
    setCommitError("");
    try {
      const res = await fetch(`/api/github/commits?owner=${owner}&repo=${repo}&branch=${branch}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch commits");
      setCommits(data);
      
      // If the selectedCommit is no longer in the list, we might want to clear it? 
      // The instructions say: "If the selected commit no longer exists... clear the selected commit safely"
      // We will do this implicitly if they try to select it, but let's do it cleanly:
      setActiveProject(prev => {
        if (prev && prev.selectedCommit) {
          const exists = data.find((c: any) => c.sha === prev.selectedCommit);
          if (!exists) {
             const updated = { ...prev, selectedCommit: "" };
             updateSavedProject(updated);
             return updated;
          }
        }
        return prev;
      });
      
    } catch (err: any) {
      setCommitError(err.message);
    } finally {
      setLoadingCommits(false);
    }
  };

  const updateSavedProject = (updated: SavedProject) => {
    const pData = localStorage.getItem('testguard_saved_projects');
    if (pData) {
      try {
        const projects = JSON.parse(pData);
        const idx = projects.findIndex((p: any) => p.id === updated.id);
        if (idx >= 0) {
          projects[idx] = updated;
          localStorage.setItem('testguard_saved_projects', JSON.stringify(projects));
        }
      } catch(e) {}
    }
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!activeProject) return;
    const branch = e.target.value;
    const updated = { ...activeProject, selectedBranch: branch, selectedCommit: "" };
    setActiveProject(updated);
    updateSavedProject(updated);
    fetchCommits(activeProject.repo.owner, activeProject.repo.repo, branch);
  };

  const handleSelectCommit = async (sha: string) => {
    if (!activeProject) return;
    
    // Save to the ACTIVE project specifically
    const updated = { ...activeProject, selectedCommit: sha };
    setActiveProject(updated);
    updateSavedProject(updated);
    
    // Clear out analysis/execution results for this project so we start fresh
    localStorage.removeItem(`testguard_changes_${activeProject.id}`);
    localStorage.removeItem(`testguard_execution_${activeProject.id}`);
    
    // Now trigger the diff fetch and save to testguard_github_state_<id>
    setLoadingCommits(true);
    setCommitError("");
    try {
      const res = await fetch(`/api/github/diff?owner=${activeProject.repo.owner}&repo=${activeProject.repo.repo}&ref=${sha}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch diff");
      
      const commitData = commits.find(c => c.sha === sha);
      const stateObj = {
        url: activeProject.url,
        repo: activeProject.repo,
        branches: activeProject.branches,
        selectedBranch: activeProject.selectedBranch,
        commits,
        selectedCommit: sha,
        commitData,
        diffFiles: data.files
      };
      
      localStorage.setItem(`testguard_github_state_${activeProject.id}`, JSON.stringify(stateObj));
      router.push('/analyze');
    } catch (err: any) {
      setCommitError(err.message);
      setLoadingCommits(false);
    }
  };

  if (!mounted) return null;

  if (!activeProject) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <Folder className="w-16 h-16 text-slate-600 mb-6 opacity-50" />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>No Active Repository</h2>
        <p style={{ color: '#94a3b8', maxWidth: '400px', marginBottom: '2rem' }}>
          Please select a project from the sidebar or add a new repository to begin tracking test impacts.
        </p>
        <Link href="/import" className="btn btn-primary">
          + Add Repository
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Active Project</h1>
        <p className="page-subtitle">Select a recent commit to analyze changes and prioritize tests.</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <GitBranch className="text-blue-500" />
              {activeProject.repo.name}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              <a href={activeProject.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                {activeProject.url}
              </a>
            </p>
          </div>
          
          <div style={{ width: '200px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>Branch</label>
            <select 
              value={activeProject.selectedBranch}
              onChange={handleBranchChange}
              disabled={loadingCommits}
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                backgroundColor: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--panel-border)',
                borderRadius: '0.375rem',
                color: 'white',
                outline: 'none'
              }}
            >
              {activeProject.branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Recent Commits</h3>
          <button 
            className="btn btn-secondary" 
            onClick={() => fetchCommits(activeProject.repo.owner, activeProject.repo.repo, activeProject.selectedBranch)}
            disabled={loadingCommits}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingCommits ? 'animate-spin' : ''}`} /> 
            {loadingCommits ? "Refreshing..." : "Refresh Commits"}
          </button>
        </div>

        {commitError && (
          <div style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
            <AlertTriangle className="w-4 h-4" />
            {commitError}
          </div>
        )}

        {loadingCommits && commits.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            Loading commits...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {commits.map(c => {
              const isSelected = activeProject.selectedCommit === c.sha;
              return (
                <div 
                  key={c.sha}
                  onClick={() => handleSelectCommit(c.sha)}
                  className="card"
                  style={{
                    padding: '1rem',
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--panel-border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.message.split('\n')[0]}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '0.875rem', fontFamily: 'monospace', backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>
                        {c.sha.substring(0, 7)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                      <span>{c.author}</span>
                      <span>{new Date(c.date).toLocaleString()}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 ${isSelected ? 'text-blue-500' : 'text-slate-500'}`} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
