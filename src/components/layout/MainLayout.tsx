import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Breadcrumbs } from "./Breadcrumbs";

export function MainLayout({ onLogout }: { onLogout: () => void }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full font-sans overflow-hidden transition-colors relative bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={onLogout} />
      <div className="flex flex-col flex-1 min-w-0 relative z-10">
        <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto px-6 md:px-10 py-6 md:py-8">
          <div className="w-full">
            <Breadcrumbs />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
