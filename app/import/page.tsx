"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Folder, UploadCloud, ChevronRight, CheckCircle2 } from "lucide-react";

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
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        setProjects(data);
        setLoading(false);
      });
  }, []);

  const handleSelectDemo = (id: string) => {
    localStorage.setItem('testguard_project', id);
    router.push('/analyze');
  };

  const handleSimulatedUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      alert("Simulated: Custom project uploaded successfully. Graph analysis complete.");
    }, 2000);
  };

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Import Project</h1>
      <p className="page-subtitle">Upload your codebase or select a demo project to analyze.</p>

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
            <UploadCloud className="text-blue-500 w-6 h-6" />
            <h3 style={{ fontSize: '1.25rem' }}>Upload Project (.zip)</h3>
          </div>
          
          <div 
            style={{ 
              border: '2px dashed var(--panel-border)', 
              borderRadius: '0.75rem', 
              padding: '3rem 2rem', 
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              backgroundColor: 'rgba(0,0,0,0.2)'
            }}
          >
            <UploadCloud className="w-12 h-12 text-slate-400" />
            <div>
              <p style={{ fontWeight: 500 }}>Drag and drop your project ZIP here</p>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>Simulated upload for this prototype</p>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleSimulatedUpload}
              disabled={uploading}
              style={{ marginTop: '1rem' }}
            >
              {uploading ? "Analyzing Graph..." : "Select File"}
            </button>
            {uploading && (
              <p style={{ color: '#10b981', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 className="w-4 h-4" /> Extracting & parsing AST...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
