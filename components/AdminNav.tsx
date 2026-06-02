"use client";

import { BarChart3, LayoutDashboard, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/forms", label: "Form Config", icon: Settings },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white px-6 py-0">
      <div className="mx-auto max-w-7xl flex items-center gap-6">
        <div className="flex items-center gap-2 mr-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Settings className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-sm">Admin Portal</span>
        </div>
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
