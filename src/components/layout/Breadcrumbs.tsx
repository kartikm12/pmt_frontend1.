import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";

export function Breadcrumbs() {
  const location = useLocation();
  const { getEntityName } = useNavigation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  if (location.pathname === "/") return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center min-w-0 space-x-2 text-sm text-zinc-500 dark:text-zinc-400 mb-6 animate-in fade-in slide-in-from-left-4 duration-500">
      <Link 
        to="/" 
        className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-1 p-1 -m-1"
      >
        <Home className="w-4 h-4" />
        <span className="sr-only">Home</span>
      </Link>
      
      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = `/${pathnames.slice(0, index + 1).join("/")}`;
        // Pages whose address isn't their name in the menu
        const PAGE_NAMES: Record<string, string> = { trash: "Recently deleted", audit: "Audit log" };
        const name = getEntityName(value) || PAGE_NAMES[value] || (value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, " "));

        return (
          <div key={to} className={`flex items-center space-x-2 min-w-0 ${last ? "" : "shrink-0"}`}>
            <ChevronRight className="w-4 h-4 shrink-0 text-zinc-300 dark:text-zinc-700" />
            {last ? (
              // A long name (e.g. a pasted link as a task title) is cut with "…" instead of widening the page
              <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate" title={name}>{name}</span>
            ) : (
              <Link to={to} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors truncate max-w-[12rem] py-1" title={name}>
                {name}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
