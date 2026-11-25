import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as Icons from "lucide-react";
import { ArrowLeft, ArrowRight, Clock, Search, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SECTIONS } from "@/help/sections";
import { canRead, findPage, neighbours, pagesFor, renderPage, searchHelp, WHO_LABEL, type Reader } from "@/help/library";
import { api } from "@/lib/api";
import { isManager } from "@/utils/roleUtils";
import { cn } from "@/lib/utils";
import "./help.css";

// Help: the guide, inside the app, for signed-in people only. Everyone sees only the pages for what their
// role can do (a page's `who`), in the menu, in search and in links.

function HelpSearchBox({ reader, autoFocus = false }: { reader: Reader; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchHelp(q, reader), [q, reader]);
  useEffect(() => setActive(0), [q]);
  const go = (i: number) => {
    const r = results[i];
    if (!r) return;
    setQ("");
    navigate(r.anchor ? `${r.page.path}#${r.anchor}` : r.page.path);
  };
  return (
    <div className="relative">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter") go(active);
          if (e.key === "Escape") setQ("");
        }}
        placeholder="Search the help, e.g. forgot password"
        aria-label="Search the help"
        className="input w-full pl-9 pr-8 py-2 text-sm"
      />
      {q && (
        <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      )}
      {q.trim().length > 1 && (
        <div role="listbox" aria-label="Help search results" className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden" data-help-results>
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Nothing found. Try another word.</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.page.path + (r.anchor ?? "")}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(i)}
                className={cn("w-full text-left px-4 py-2.5 border-b last:border-b-0 border-slate-100 dark:border-slate-800", i === active && "bg-indigo-50 dark:bg-indigo-900/30")}
              >
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">{r.page.title}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{r.heading ? `${r.page.sectionTitle} · ${r.heading}` : r.page.sectionTitle}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function HelpMenu({ reader, current }: { reader: Reader; current?: string }) {
  const mine = pagesFor(reader);
  return (
    <nav aria-label="Help topics" className="space-y-4" data-help-menu>
      {SECTIONS.map((s) => {
        const pages = mine.filter((p) => p.section === s.id);
        if (!pages.length) return null;
        return (
          <div key={s.id}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{s.title}</p>
            <ul className="space-y-0.5">
              {pages.map((p) => (
                <li key={p.path}>
                  <Link to={p.path} className={cn("block rounded-lg px-2.5 py-1.5 text-sm", current === p.path ? "bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/30 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800")}>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Help() {
  const { section, page: slug } = useParams();
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const page = section && slug ? findPage(section, slug) : null;
  // Someone who isn't a manager may still run a project (Owner or Manager there): they get its guides too
  const [managesAProject, setManagesAProject] = useState(false);
  useEffect(() => {
    if (!currentUser || isManager(role)) return;
    let live = true;
    api.getProjects()
      .then((list) => live && setManagesAProject(list.some((p) => p.managerId === currentUser.id || ["OWNER", "MANAGER"].includes(p.memberRoles?.[currentUser.id] ?? ""))))
      .catch(() => undefined);
    return () => { live = false; };
  }, [currentUser, role]);
  const reader = useMemo<Reader>(() => ({ role, managesAProject }), [role, managesAProject]);

  return (
    <div className="hp grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-8 max-w-6xl" data-help>
      <aside className="hidden lg:block space-y-5 lg:sticky lg:top-0 self-start max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
        <Link to="/help" className="text-sm font-bold text-slate-900 dark:text-white">Help</Link>
        <HelpSearchBox reader={reader} />
        <HelpMenu reader={reader} current={page?.path} />
      </aside>
      <div className="min-w-0">{section && slug ? <HelpArticle reader={reader} section={section} slug={slug} /> : <HelpHome reader={reader} />}</div>
    </div>
  );
}

function HelpHome({ reader }: { reader: Reader }) {
  const mine = pagesFor(reader);
  return (
    <div className="space-y-6" data-help-home>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Help</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">How to use PMT, step by step, with pictures of the real screens. You see the guides for what your role can do.</p>
      </div>
      <div className="lg:hidden"><HelpSearchBox reader={reader} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECTIONS.map((s) => {
          const pages = mine.filter((p) => p.section === s.id);
          if (!pages.length) return null;
          const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[s.icon] ?? Icons.BookOpen;
          return (
            <div key={s.id} className="card p-5" data-help-section={s.id}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center"><Icon className="w-5 h-5" aria-hidden="true" /></span>
                <h2 className="font-semibold text-slate-900 dark:text-white">{s.title}</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{s.blurb}</p>
              <ul className="mt-3 space-y-1">
                {pages.map((p) => (
                  <li key={p.path}><Link to={p.path} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">{p.title}</Link></li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HelpArticle({ reader, section, slug }: { reader: Reader; section: string; slug: string }) {
  const navigate = useNavigate();
  const page = findPage(section, slug);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const rendered = useMemo(() => (page && canRead(page.who, reader) ? renderPage(page, reader) : null), [page, reader]);

  // In-guide links stay inside the app; pictures open bigger; arriving at #step scrolls to it
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[data-internal]") as HTMLAnchorElement | null;
      if (a) { e.preventDefault(); navigate(a.getAttribute("href")!); return; }
      const img = (e.target as HTMLElement).closest(".hp-shot img") as HTMLImageElement | null;
      if (img) setZoom(img.src);
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [navigate, rendered]);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
    else document.querySelector("main")?.scrollTo({ top: 0 });
  }, [section, slug]);

  if (!page) {
    return (
      <div className="card p-8 text-center" data-help-missing>
        <p className="font-semibold text-slate-800 dark:text-slate-100">That help page doesn't exist</p>
        <Link to="/help" className="btn-secondary inline-flex px-4 py-2 text-sm mt-4">All help topics</Link>
      </div>
    );
  }
  if (!canRead(page.who, reader)) {
    return (
      <div className="card p-8 text-center" data-help-not-for-you>
        <p className="font-semibold text-slate-800 dark:text-slate-100">This guide is for {WHO_LABEL[page.who]}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">It explains something your role can't do in PMT. Ask your manager if you need it done.</p>
        <Link to="/help" className="btn-secondary inline-flex px-4 py-2 text-sm mt-4">Help for your role</Link>
      </div>
    );
  }
  const { prev, next } = neighbours(page, reader);
  return (
    <article className="max-w-3xl" data-help-page={page.path}>
      <nav className="text-xs text-slate-500 dark:text-slate-400 mb-3"><Link to="/help" className="hover:underline">Help</Link> <span aria-hidden="true">›</span> {page.sectionTitle}</nav>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{page.title}</h1>
      {page.summary && <p className="text-slate-600 dark:text-slate-300 mt-2">{page.summary}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-3">
        <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" aria-hidden="true" /> For {WHO_LABEL[page.who]}</span>
        {page.minutes && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" aria-hidden="true" /> {page.minutes} min read</span>}
        {page.app && <Link to={page.app} className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline" data-help-open-app>Open {page.appLabel || "it"} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></Link>}
      </div>
      <div className="lg:hidden mt-4"><HelpSearchBox reader={reader} /></div>
      <div ref={bodyRef} className="hp-body mt-6" dangerouslySetInnerHTML={{ __html: rendered!.html }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 pt-6 border-t border-slate-200 dark:border-slate-800">
        {prev ? (
          <Link to={prev.path} className="card p-4 hover:border-indigo-300" data-help-prev><span className="text-xs text-slate-500 inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Previous</span><span className="block font-semibold text-slate-900 dark:text-white mt-1">{prev.title}</span></Link>
        ) : <span />}
        {next && (
          <Link to={next.path} className="card p-4 text-right hover:border-indigo-300" data-help-next><span className="text-xs text-slate-500 inline-flex items-center gap-1">Next <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></span><span className="block font-semibold text-slate-900 dark:text-white mt-1">{next.title}</span></Link>
        )}
      </div>
      {zoom && (
        <div className="hp-zoom" role="dialog" aria-label="Picture, bigger" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
        </div>
      )}
    </article>
  );
}
