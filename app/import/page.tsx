"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Folder, GitBranch, GitCommit, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";

interface ProjectSummary {
  id: string;
  name: string;
  languages: string[];
  nodeCount: number;
  testCount: number;
}

export default function ImportProject() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // GitHub state
  const [githubUrl, setGithubUrl] = useState("");
  const [githubRepo, setGithubRepo] = useState<any>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedCommit, setSelectedCommit] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState("");

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        setProjects(data);
        setLoading(false);
      });

    // Hydrate GitHub state if available
    const savedState = localStorage.getItem('testguard_github_state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.url) setGithubUrl(parsed.url);
        if (parsed.repo) setGithubRepo(parsed.repo);
        if (parsed.branches) setBranches(parsed.branches);
        if (parsed.selectedBranch) setSelectedBranch(parsed.selectedBranch);
        if (parsed.commits) setCommits(parsed.commits);
        if (parsed.selectedCommit) setSelectedCommit(parsed.selectedCommit);
      } catch (e) {
        console.error("Failed to parse saved github state", e);
      }
    }
  }, []);

  // Sync state to localStorage whenever it changes
  useEffect(() => {
    if (githubRepo) {
      localStorage.setItem('testguard_github_state', JSON.stringify({
        url: githubUrl,
        repo: githubRepo,
        branches,
        selectedBranch,
        commits,
        selectedCommit
      }));
    }
  }, [githubUrl, githubRepo, branches, selectedBranch, commits, selectedCommit]);

  const handleSelectDemo = (id: string) => {
    localStorage.setItem('testguard_project', id);
    // Clear out any previous github state
    localStorage.removeItem('testguard_github_state');
    router.push('/analyze');
  };

  const handleConnectGitHub = async () => {
    if (!githubUrl) return;
    setGithubLoading(true);
    setGithubError("");
    setGithubRepo(null);
    setBranches([]);
    setCommits([]);
    
    try {
      const res = await fetch(`/api/github/repo?url=${encodeURIComponent(githubUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch repository");
      
      setGithubRepo(data);
      setBranches(data.branches);
      if (data.branches.includes(data.defaultBranch)) {
        setSelectedBranch(data.defaultBranch);
        fetchCommits(data.owner, data.repo, data.defaultBranch);
      } else if (data.branches.length > 0) {
        setSelectedBranch(data.branches[0]);
        fetchCommits(data.owner, data.repo, data.branches[0]);
      }
    } catch (err: any) {
      setGithubError(err.message);
    } finally {
      setGithubLoading(false);
    }
  };

  const fetchCommits = async (owner: string, repo: string, branch: string) => {
    setGithubLoading(true);
    try {
      const res = await fetch(`/api/github/commits?owner=${owner}&repo=${repo}&branch=${branch}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch commits");
      setCommits(data);
    } catch (err: any) {
      setGithubError(err.message);
    } finally {
      setGithubLoading(false);
    }
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const branch = e.target.value;
    setSelectedBranch(branch);
    if (githubRepo) {
      fetchCommits(githubRepo.owner, githubRepo.repo, branch);
    }
  };

  const handleSelectCommit = async (sha: string) => {
    if (!githubRepo) return;
    setSelectedCommit(sha);
    setGithubLoading(true);
    setGithubError("");
    try {
      const res = await fetch(`/api/github/diff?owner=${githubRepo.owner}&repo=${githubRepo.repo}&ref=${sha}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch diff");
      
      // Store real github diff info for analyze page
      localStorage.setItem('testguard_project', 'github');
      
      const commitData = commits.find(c => c.sha === sha);
      const stateObj = {
        url: githubUrl,
        repo: githubRepo,
        branches,
        selectedBranch,
        commits,
        selectedCommit: sha,
        commitData,
        diffFiles: data.files
      };
      localStorage.setItem('testguard_github_state', JSON.stringify(stateObj));
      
      router.push('/analyze');
    } catch (err: any) {
      setGithubError(err.message);
      setGithubLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Import Project</h1>
      <p className="page-subtitle">Connect a GitHub repository or select a demo project to analyze.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Folder className="text-blue-500 w-6 h-6" />
            <h3 style={{ fontSize: '1.25rem' }}>Demo Projects</h3>
          </div>
          
          {loading ? (
            <p style={{ color: '#94a3b8' }}>Loading available demos...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {projects.map((proj) => (
                <div 
                  key={proj.id} 
                  style={{ 
                    padding: '1rem', 
                    borderRadius: '0.5rem', 
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--panel-border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => handleSelectDemo(proj.id)}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--panel-border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontWeight: 600 }}>{proj.name}</h4>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                    <span>{proj.languages.join(", ")}</span>
                    <span>•</span>
                    <span>{proj.nodeCount} Code Entities</span>
                    <span>•</span>
                    <span>{proj.testCount} Tests</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <GitBranch className="text-blue-500 w-6 h-6" />
            <h3 style={{ fontSize: '1.25rem' }}>Connect GitHub</h3>
          </div>
          
          {!githubRepo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="text" 
                placeholder="https://github.com/owner/repository" 
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem 1rem', 
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '0.375rem',
                  color: 'white',
                  outline: 'none'
                }}
              />
              <button 
                className="btn btn-primary" 
                onClick={handleConnectGitHub}
                disabled={githubLoading || !githubUrl}
              >
                {githubLoading ? "Connecting..." : "Connect Repository"}
              </button>
              
              {githubError && (
                <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <AlertTriangle className="w-4 h-4" />
                  {githubError}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h4 style={{ fontWeight: 600, fontSize: '1.125rem' }}>{githubRepo.name}</h4>
                {githubRepo.description && <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>{githubRepo.description}</p>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>Select Branch</label>
                <select 
                  value={selectedBranch}
                  onChange={handleBranchChange}
                  disabled={githubLoading}
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
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>Recent Commits</label>
                {githubLoading && commits.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Loading commits...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {commits.map(c => (
                      <div 
                        key={c.sha}
                        onClick={() => handleSelectCommit(c.sha)}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: selectedCommit === c.sha ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${selectedCommit === c.sha ? 'var(--primary)' : 'var(--panel-border)'}`,
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 500, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                            {c.message.split('\n')[0]}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            {c.sha.substring(0, 7)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                          <span>{c.author}</span>
                          <span>{new Date(c.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {githubError && (
                <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <AlertTriangle className="w-4 h-4" />
                  {githubError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
