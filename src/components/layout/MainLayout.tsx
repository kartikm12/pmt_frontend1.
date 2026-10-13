import { Suspense, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Breadcrumbs } from "./Breadcrumbs";
import { SearchPalette } from "./SearchPalette";
import { PageLoader } from "@/components/ui/PageLoader";
import { preloadPages } from "@/pages/lazyPages";

export function MainLayout({ onLogout }: { onLogout: () => void }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(preloadPages, []);

  // Ctrl+K (Cmd+K on Mac) opens search from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen w-full font-sans overflow-hidden transition-colors relative bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={onLogout} />
      <div className="flex flex-col flex-1 min-w-0 relative z-10">
        <TopBar onMenuClick={() => setIsSidebarOpen(true)} onSearchClick={() => setIsSearchOpen(true)} />
        <main className="flex-1 overflow-y-auto px-6 md:px-10 py-6 md:py-8">
          <div className="w-full">
            <Breadcrumbs />
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <SearchPalette open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
