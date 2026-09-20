"use client";

import Link from "next/link";
import { Activity, GitBranch, Trash2, ArrowRight, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SavedProject {
  id: string;
  url: string;
  repo: any;
  branches: string[];
  selectedBranch: string;
  selectedCommit: string;
  lastAnalyzed?: string;
  testCount?: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);

  useEffect(() => {
    setMounted(true);
    
    // Load projects from localStorage
    const loadProjects = () => {
      const projectsData = localStorage.getItem('testguard_saved_projects');
      if (projectsData) {
        try {
          setSavedProjects(JSON.parse(projectsData));
        } catch (e) {
          console.error("Failed to parse saved projects", e);
        }
      }
    };
    
    loadProjects();
  }, []);

  const handleOpenProject = (proj: SavedProject) => {
    // Set the active github state
    localStorage.setItem('testguard_project', 'github');
    
    // We recreate the state object needed by the app
    const stateObj = {
      url: proj.url,
      repo: proj.repo,
      branches: proj.branches,
      selectedBranch: proj.selectedBranch,
      selectedCommit: proj.selectedCommit,
      commits: [], // this can be fetched again on the import page if needed, but we have selectedCommit
    };
    localStorage.setItem('testguard_github_state', JSON.stringify(stateObj));
    router.push('/import'); // Navigate to import page to review/change commit
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newProjects = savedProjects.filter(p => p.id !== id);
    setSavedProjects(newProjects);
    localStorage.setItem('testguard_saved_projects', JSON.stringify(newProjects));
    
    // If it was the currently active project, clear active state
    const currentActiveStr = localStorage.getItem('testguard_github_state');
    if (currentActiveStr) {
      const currentActive = JSON.parse(currentActiveStr);
      if (`${currentActive.repo.owner}/${currentActive.repo.repo}` === id) {
        localStorage.removeItem('testguard_github_state');
        localStorage.removeItem('testguard_project');
        localStorage.removeItem('testguard_changes');
      }
    }
  };

  if (!mounted) return null;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage your connected repositories and analysis history.</p>
        </div>
        <Link href="/import" className="btn btn-primary">
          + Add Repository
        </Link>
      </div>

      {savedProjects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', border: '1px dashed var(--panel-border)' }}>
          <GitBranch className="w-12 h-12 mx-auto text-slate-500 mb-4 opacity-50" />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No projects yet</h3>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto' }}>
            Connect a GitHub repository to begin tracking code changes, dependencies, and impacted tests.
          </p>
          <Link href="/import" className="btn btn-primary">
            Connect Repository
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {savedProjects.map((proj) => (
            <div key={proj.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.375rem' }}>
                    <GitBranch className="w-6 h-6 text-slate-300" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{proj.repo.repo}</h3>
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{proj.repo.owner}</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => handleDeleteProject(e, proj.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                  title="Remove Project"
                >
                  <Trash2 className="w-4 h-4 opacity-70 hover:opacity-100" />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                  <span style={{ color: '#94a3b8' }}>Branch:</span>
                  <span style={{ fontWeight: 500 }}>{proj.selectedBranch}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                  <span style={{ color: '#94a3b8' }}>Commit:</span>
                  <span style={{ fontFamily: 'monospace' }}>{proj.selectedCommit ? proj.selectedCommit.substring(0, 7) : 'None'}</span>
                </div>
                {proj.lastAnalyzed && (
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                    <span style={{ color: '#94a3b8' }}>Last Analyzed:</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock className="w-3 h-3" /> {new Date(proj.lastAnalyzed).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--panel-border)' }}>
                <button 
                  onClick={() => handleOpenProject(proj)}
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Open Project <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
