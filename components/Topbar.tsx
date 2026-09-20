import { Bell, Settings, User } from "lucide-react";

export default function Topbar() {
  return (
    <header className="topbar">
      <div style={{ display: 'flex', gap: '1rem', color: '#94a3b8' }}>
        <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
          <Bell className="w-5 h-5" />
        </button>
        <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
          <Settings className="w-5 h-5" />
        </button>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.5)' }}>
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
}
