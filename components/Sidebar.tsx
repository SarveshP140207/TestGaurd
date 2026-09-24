"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert, Plus, Circle, CircleDot, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { useEffect, useState } from "react";

interface SavedProject {
  id: string;
  url: string;
  repo: any;
  branches: string[];
  selectedBranch: string;
  selectedCommit: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    // Load projects and active ID
    const loadState = () => {
      let aId = localStorage.getItem('testguard_active_project_id');
      const pData = localStorage.getItem('testguard_saved_projects');
      if (pData) {
        try { 
          const parsed = JSON.parse(pData);
          setProjects(parsed); 
          const isDemo = aId === 'ecommerce-demo' || aId === 'banking-demo';
          if ((!aId || (!parsed.find((p: any) => p.id === aId) && !isDemo)) && parsed.length > 0) {
            aId = parsed[0].id;
            localStorage.setItem('testguard_active_project_id', aId);
            window.dispatchEvent(new Event('testguard-project-changed'));
          }
        } catch(e) {}
      }
      setActiveId(aId);
    };

    loadState();

    // Listen for storage changes
    window.addEventListener('storage', loadState);
    const interval = setInterval(loadState, 500);

    return () => {
      window.removeEventListener('storage', loadState);
      clearInterval(interval);
    };
  }, []);

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to remove this repository from TestGuard?')) {
      const pData = localStorage.getItem('testguard_saved_projects');
      if (pData) {
        let p = JSON.parse(pData);
        p = p.filter((proj: any) => proj.id !== id);
        localStorage.setItem('testguard_saved_projects', JSON.stringify(p));
        setProjects(p);
      }
      if (activeId === id) {
        localStorage.removeItem('testguard_active_project_id');
        setActiveId(null);
        router.push('/');
      }
    }
  };

  const handleSelectProject = (id: string) => {
    localStorage.setItem('testguard_active_project_id', id);
    setActiveId(id);
    
    window.dispatchEvent(new Event('testguard-project-changed'));
    
    // Demo projects route directly to analyze, github projects route to dashboard
    if (id.includes('/')) {
      router.push('/');
    } else {
      router.push('/analyze');
    }
  };

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="sidebar-header" style={{ marginBottom: '2rem' }}>
        <ShieldAlert className="w-6 h-6 text-blue-500" />
        <span className="sidebar-title">TestGuard</span>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', padding: '0 1.5rem', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>PROJECTS</h3>
        <nav className="sidebar-nav">
          {projects.map((proj) => {
            const isActive = proj.id === activeId;
            return (
              <div
                key={proj.id}
                onClick={() => handleSelectProject(proj.id)}
                className={clsx("nav-item", isActive && "active")}
                style={{ cursor: 'pointer', paddingLeft: '1.5rem', paddingRight: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                  {isActive ? <CircleDot className="w-4 h-4 text-blue-500 flex-shrink-0" /> : <Circle className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.repo.name}</span>
                </div>
                <button 
                  onClick={(e) => handleDeleteProject(e, proj.id)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
                  title="Remove Repository"
                >
                  <Trash2 className="w-4 h-4 hover:text-red-400" />
                </button>
              </div>
            );
          })}
        </nav>

        <div style={{ padding: '1rem 1.5rem', marginTop: '1rem' }}>
          <Link href="/import" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            <Plus className="w-4 h-4 mr-2" /> Add Repository
          </Link>
        </div>

        <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', padding: '0 1.5rem', marginTop: '2rem', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>DEMO PROJECTS</h3>
        <nav className="sidebar-nav">
          {['ecommerce-demo', 'banking-demo'].map((demoId) => {
            const isActive = demoId === activeId;
            return (
              <div
                key={demoId}
                onClick={() => handleSelectProject(demoId)}
                className={clsx("nav-item", isActive && "active")}
                style={{ cursor: 'pointer', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}
              >
                {isActive ? <CircleDot className="w-4 h-4 text-blue-500" /> : <Circle className="w-4 h-4 text-slate-500" />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {demoId === 'ecommerce-demo' ? 'E-Commerce Demo' : 'Banking API Demo'}
                </span>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
