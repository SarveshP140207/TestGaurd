"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, LayoutDashboard, UploadCloud, GitPullRequest, Info, ListChecks } from "lucide-react";
import { clsx } from "clsx";

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Import Project", href: "/import", icon: UploadCloud },
    { name: "Analyze Change", href: "/analyze", icon: GitPullRequest },
    { name: "Prioritization Results", href: "/results", icon: ListChecks },
    { name: "Project Info", href: "/info", icon: Info },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <ShieldAlert className="w-6 h-6 text-blue-500" />
        <span className="sidebar-title">TestGuard</span>
      </div>
      <nav className="sidebar-nav">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={clsx("nav-item", isActive && "active")}
            >
              <Icon className="w-5 h-5" />
              {link.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
