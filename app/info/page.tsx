"use client";

import { Info, Code, Lock, Lightbulb, Workflow } from "lucide-react";

export default function ProjectInfo() {
  return (
    <div className="animate-fade-in">
      <h1 className="page-title">About TestGuard</h1>
      <p className="page-subtitle">Intelligent Software Test Prioritization System (Prototype)</p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info className="w-5 h-5 text-blue-500" /> The Problem
            </h2>
            <p style={{ color: '#94a3b8', lineHeight: 1.7 }}>
              In large software projects, running the entire test suite after every small code change is slow, expensive, and delays developer feedback. Developers often guess which tests to run, risking missed regressions or wasting time on unrelated tests.
            </p>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lightbulb className="w-5 h-5 text-yellow-500" /> The Solution
            </h2>
            <p style={{ color: '#94a3b8', lineHeight: 1.7, marginBottom: '1rem' }}>
              TestGuard analyzes codebase dependencies to determine exactly which tests are impacted by a specific code change. It calculates a risk priority score based on:
            </p>
            <ul style={{ color: '#94a3b8', marginLeft: '1.5rem', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>Dependency proximity (direct vs indirect impact)</li>
              <li>Historical test failure rates (flakiness)</li>
              <li>Module criticality</li>
              <li>Test execution time</li>
            </ul>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Workflow className="w-5 h-5 text-emerald-500" /> System Architecture
            </h2>
            <p style={{ color: '#94a3b8', lineHeight: 1.7 }}>
              The prototype is built using a modern Next.js (React + Node.js) stack. 
              The core engine converts language-specific code structures into a universal directed graph. 
              When a change is analyzed, a Breadth-First Search (BFS) traverses the impact edges (e.g., modified function ➔ callers ➔ covering tests) to calculate impact distances and priority scores.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Code className="w-5 h-5 text-purple-500" /> Supported Languages
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
              The universal dependency graph can conceptually support any language. Current mock parsers demonstrate:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span className="badge badge-neutral">Python</span>
              <span className="badge badge-neutral">Java</span>
              <span className="badge badge-neutral">C++</span>
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock className="w-5 h-5 text-red-500" /> Limitations
            </h2>
            <ul style={{ color: '#94a3b8', fontSize: '0.875rem', marginLeft: '1rem', listStyleType: 'circle', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>This is a functional college prototype, not a production tool.</li>
              <li>Dependency parsing is simulated for the demo projects rather than running a full compiler AST on real-time uploads.</li>
              <li>Test execution is simulated rather than executing real sub-processes.</li>
            </ul>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Future Improvements</h2>
            <ul style={{ color: '#94a3b8', fontSize: '0.875rem', marginLeft: '1rem', listStyleType: 'circle', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>GitHub/GitLab PR integration</li>
              <li>Real-time CI/CD pipeline hooks</li>
              <li>Machine-learning-based failure prediction</li>
              <li>AST parsers for full production scale</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
