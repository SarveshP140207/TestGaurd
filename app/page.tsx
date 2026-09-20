"use client";

import Link from "next/link";
import { Activity, FileCode, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pieData = [
    { name: 'High Priority', value: 3, color: '#ef4444' },
    { name: 'Medium Priority', value: 5, color: '#f59e0b' },
    { name: 'Low Priority', value: 22, color: '#10b981' },
  ];

  if (!mounted) return null;

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Overview of your software testing risk and impact.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 500 }}>Active Project</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>E-Commerce Demo</p>
            </div>
            <Activity className="text-blue-500 w-8 h-8 opacity-80" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className="badge badge-neutral">Python</span>
            <span className="badge badge-neutral">React</span>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 500 }}>Total Tests</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>30</p>
            </div>
            <CheckCircle className="text-emerald-500 w-8 h-8 opacity-80" />
          </div>
          <p style={{ fontSize: '0.875rem', color: '#10b981' }}>+2 this week</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 500 }}>Source Files</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>145</p>
            </div>
            <FileCode className="text-slate-400 w-8 h-8 opacity-80" />
          </div>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>1.2M lines of code</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 500 }}>Last Analysis</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>3 High Risk</p>
            </div>
            <AlertTriangle className="text-red-500 w-8 h-8 opacity-80" />
          </div>
          <p style={{ fontSize: '0.875rem', color: '#ef4444' }}>Requires attention</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Get Started</h3>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
            Import a new project or select an existing demo to analyze codebase changes and optimize your test execution strategy.
          </p>
          <div style={{ marginTop: 'auto', display: 'flex', gap: '1rem' }}>
            <Link href="/import" className="btn btn-primary">
              Import Project <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/info" className="btn btn-secondary">
              Learn How It Works
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Latest Prioritization</h3>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} /> High
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b' }} /> Med
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} /> Low
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
