"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ImportProject() {
  const router = useRouter();

  // GitHub state
  const [githubUrl, setGithubUrl] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState("");

  const handleConnectGitHub = async () => {
    if (!githubUrl) return;
    setGithubLoading(true);
    setGithubError("");
    
    try {
      const res = await fetch(`/api/github/repo?url=${encodeURIComponent(githubUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch repository");
      
      const projectId = `${data.owner}/${data.repo}`;
      
      // Save project to Dashboard
      const savedStr = localStorage.getItem('testguard_saved_projects');
      let savedProjects = [];
      if (savedStr) {
        try { savedProjects = JSON.parse(savedStr); } catch (e) {}
      }
      
      const existingIdx = savedProjects.findIndex((p: any) => p.id === projectId);
      const newSavedProject = {
        id: projectId,
        url: githubUrl,
        repo: data,
        branches: data.branches,
        selectedBranch: data.branches.includes(data.defaultBranch) ? data.defaultBranch : (data.branches[0] || "main"),
        selectedCommit: ""
      };
      
      if (existingIdx >= 0) {
        // Do not duplicate, just open the existing one
        savedProjects[existingIdx] = { ...savedProjects[existingIdx], ...newSavedProject };
      } else {
        savedProjects.push(newSavedProject);
      }
      localStorage.setItem('testguard_saved_projects', JSON.stringify(savedProjects));
      
      // Make it active
      localStorage.setItem('testguard_active_project_id', projectId);
      
      // Navigate to dashboard
      router.push('/');
    } catch (err: any) {
      setGithubError(err.message);
      setGithubLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '4rem' }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>
      
      <h1 className="page-title">Add Repository</h1>
      <p className="page-subtitle">Connect a GitHub repository to track changes and prioritize tests.</p>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <GitBranch className="text-blue-500 w-6 h-6" />
          <h3 style={{ fontSize: '1.25rem' }}>Connect GitHub</h3>
        </div>
        
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
            style={{ justifyContent: 'center' }}
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
      </div>
    </div>
  );
}
