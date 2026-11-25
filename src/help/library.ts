import { Marked, type Tokens } from "marked";
import { SECTIONS } from "./sections";

// The Help pages: read from content/<section>/<page>.md, filtered by who they're for, rendered with
// numbered rings ([[1]]) and real screenshots from images/<section>/<page>/. Ported from Inventory's Help,
// English only, and each page says who it's for:
//   who: everyone  — everyone signed in
//   who: project   — managers, plus anyone who is Owner or Manager of at least one project
//   who: managers  — Admins, Managers and Project Managers
//   who: admins    — Admins only

const FILES = import.meta.glob("./content/**/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const IMAGES = import.meta.glob("./images/**/*.{webp,png}", { import: "default", eager: true }) as Record<string, string>;

export type Who = "everyone" | "project" | "managers" | "admins";
/** Who is reading: their company role, and whether they run at least one project (Owner or Manager there) */
export type Reader = { role?: string; managesAProject?: boolean };
export type HelpPage = {
  section: string;
  sectionTitle: string;
  slug: string;
  path: string;
  title: string;
  summary: string;
  who: Who;
  minutes: number | null;
  app: string;
  appLabel: string;
  keywords: string;
  body: string;
};

const MANAGER_ROLES = ["Admin", "Manager", "Project Manager"];
export const WHO_LABEL: Record<Who, string> = { everyone: "Everyone", project: "people who manage a project", managers: "Admins, Managers and Project Managers", admins: "Admins" };

/** May someone with this role read this page (i.e. use the screen it explains)? */
export function canRead(who: Who, reader: Reader): boolean {
  const { role } = reader;
  if (who === "admins") return role === "Admin";
  if (who === "managers") return MANAGER_ROLES.includes(role ?? "");
  if (who === "project") return MANAGER_ROLES.includes(role ?? "") || !!reader.managesAProject;
  return !!role;
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

let built: { pages: HelpPage[]; byPath: Map<string, HelpPage> } | null = null;
function build() {
  if (built) return built;
  const pages: HelpPage[] = [];
  const byPath = new Map<string, HelpPage>();
  for (const section of SECTIONS) {
    for (const slug of section.pages) {
      const raw = FILES[`./content/${section.id}/${slug}.md`];
      if (!raw) continue;
      const { meta, body } = parseFrontmatter(raw);
      const who = (["everyone", "project", "managers", "admins"].includes(meta.who) ? meta.who : "everyone") as Who;
      const page: HelpPage = {
        section: section.id,
        sectionTitle: section.title,
        slug,
        path: `/help/${section.id}/${slug}`,
        title: meta.title || slug,
        summary: meta.summary || "",
        who,
        minutes: Number(meta.minutes) || null,
        app: meta.app || "",
        appLabel: meta.appLabel || "",
        keywords: meta.keywords || "",
        body
      };
      pages.push(page);
      byPath.set(page.path, page);
    }
  }
  built = { pages, byPath };
  return built;
}

export const allPages = () => build().pages;
export const pagesFor = (reader: Reader) => build().pages.filter((p) => canRead(p.who, reader));
export const findPage = (section: string, slug: string) => build().byPath.get(`/help/${section}/${slug}`) ?? null;
export const pageExists = (path: string) => build().byPath.has(String(path).split("#")[0].split("?")[0]);

export function neighbours(page: HelpPage, reader: Reader) {
  const list = pagesFor(reader);
  const i = list.findIndex((p) => p.path === page.path);
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
}

const escapeHtml = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const slugify = (text: string) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
const imageUrl = (page: HelpPage, file: string) => IMAGES[`./images/${page.section}/${page.slug}/${file}`] ?? null;

/** The page as HTML, its step list for the side, and any pictures it names that don't exist. */
export function renderPage(page: HelpPage, reader: Reader) {
  const toc: { id: string; title: string }[] = [];
  const used = new Set<string>();
  const missing: string[] = [];
  const uniqueId = (text: string) => {
    const base = slugify(text) || "section";
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  const boxes = {
    name: "helpBox",
    level: "block" as const,
    start: (src: string) => src.match(/^:::/m)?.index,
    tokenizer(this: { lexer: { blockTokens: (s: string, t: unknown[]) => unknown[] } }, src: string) {
      const m = /^:::(tip|note|warning|faq)[ \t]*([^\n]*)\n([\s\S]*?)\n:::[ \t]*(?:\n+|$)/.exec(src);
      if (!m) return undefined;
      return { type: "helpBox", raw: m[0], kind: m[1], title: m[2].trim(), tokens: this.lexer.blockTokens(m[3], []) };
    },
    renderer(this: { parser: { parse: (t: unknown) => string } }, token: Tokens.Generic) {
      const inner = this.parser.parse(token.tokens);
      if (token.kind === "faq") return `<details class="hp-faq" id="${uniqueId(token.title)}"><summary>${escapeHtml(token.title)}</summary><div>${inner}</div></details>`;
      const label = token.title || ({ tip: "Tip", note: "Good to know", warning: "Careful" } as Record<string, string>)[token.kind];
      return `<div class="hp-box hp-box-${token.kind}" role="note"><strong class="hp-box-title">${escapeHtml(label)}</strong>${inner}</div>`;
    }
  };
  const markers = {
    name: "helpMark",
    level: "inline" as const,
    start: (src: string) => src.indexOf("[["),
    tokenizer(src: string) {
      const m = /^\[\[(\d{1,2})\]\]/.exec(src);
      return m ? { type: "helpMark", raw: m[0], n: m[1] } : undefined;
    },
    renderer: (token: Tokens.Generic) => `<span class="hp-mk" aria-label="${token.n}">${token.n}</span>`
  };
  const marked = new Marked({
    gfm: true,
    extensions: [boxes, markers] as never,
    renderer: {
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens);
        const plain = text.replace(/\[\[\d+\]\]/g, "").replace(/[*_`]/g, "");
        const step = depth === 2 && /^(\d{1,2})\.\s+/.exec(plain);
        const label = step ? plain.slice(step[0].length) : plain;
        const id = uniqueId(label);
        if (depth === 2) toc.push({ id, title: label });
        if (step) return `<h2 id="${id}" class="hp-step"><b aria-hidden="true">${step[1]}</b><span>${inner.replace(/^\d{1,2}\.\s+/, "")}</span></h2>`;
        return `<h${depth} id="${id}">${inner}</h${depth}>`;
      },
      image({ href, title, text }) {
        const url = imageUrl(page, href);
        // A picture that doesn't exist is left out, never shown as a gap; the Help test fails on one
        if (!url) {
          missing.push(href);
          return "";
        }
        return `<figure class="hp-shot"><img src="${url}" alt="${escapeHtml(text)}" loading="lazy" decoding="async">${title ? `<figcaption>${escapeHtml(title)}</figcaption>` : ""}</figure>`;
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        if (href.startsWith("/help/")) {
          const target = build().byPath.get(href.split("#")[0]);
          // A guide that isn't written, or that this person's role doesn't cover, reads as plain words
          if (!target || !canRead(target.who, reader)) return `<span class="hp-soon">${inner}</span>`;
        }
        const external = /^https?:/.test(href);
        return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ""}${external ? ' target="_blank" rel="noopener noreferrer"' : ' data-internal="1"'}>${inner}</a>`;
      }
    }
  });
  const flat = (marked.parse(page.body) as string).replace(/<p>\s*(<figure[\s\S]*?<\/figure>)\s*<\/p>/g, "$1").replace(/<p>\s*<\/p>/g, "");
  // Each step title and what follows it become one block, so its words and pictures sit under it
  const html = flat
    .split(/(?=<h2[\s>])/)
    .map((part) => (part.startsWith("<h2") ? `<section class="hp-sec${/^<h2 id="[^"]*" class="hp-step"/.test(part) ? " hp-sec-step" : ""}">${part}</section>` : part))
    .join("");
  return { html, toc, missing };
}

const plainText = (md: string) =>
  md.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[\[\d+\]\]/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/^:::\w*\s*/gm, " ").replace(/[#>*_`|]/g, " ").replace(/\s+/g, " ").toLowerCase();

/** Word search over the pages this person may read: title first, then step headings, then the rest. */
export function searchHelp(query: string, reader: Reader, limit = 8) {
  const words = query.toLowerCase().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}-]/gu, "")).filter((w) => w.length > 1);
  if (!words.length) return [];
  const results: { page: HelpPage; score: number; heading: string | null; anchor: string | null }[] = [];
  for (const page of pagesFor(reader)) {
    const title = page.title.toLowerCase();
    const headings = [...page.body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].replace(/^\d+\.\s+/, "").replace(/\[\[\d+\]\]/g, "").trim());
    const faqs = [...page.body.matchAll(/^:::faq\s+(.+)$/gm)].map((m) => m[1].trim());
    const keys = [...headings, ...faqs].map((h) => h.toLowerCase());
    const text = `${page.summary} ${page.keywords} ${plainText(page.body)}`.toLowerCase();
    let score = 0;
    let ok = true;
    for (const w of words) {
      const t = title.includes(w), h = keys.some((k) => k.includes(w)), b = text.includes(w);
      if (!t && !h && !b) { ok = false; break; }
      score += (t ? 10 : 0) + (h ? 4 : 0) + (b ? 1 : 0) + (title.startsWith(w) ? 3 : 0);
    }
    if (!ok) continue;
    if (words.every((w) => title.includes(w))) {
      results.push({ page, score: score + 5, heading: null, anchor: null });
      continue;
    }
    const heading = [...headings, ...faqs].map((x) => ({ x, hits: words.filter((w) => x.toLowerCase().includes(w)).length })).filter((y) => y.hits > 0).sort((a, b) => b.hits - a.hits)[0]?.x ?? null;
    results.push({ page, score, heading, anchor: heading ? slugify(heading) : null });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** The guide for the screen someone is on (for the "Help for this page" link) */
export function pageForRoute(pathname: string, reader: Reader): HelpPage | null {
  const list = pagesFor(reader).filter((p) => p.app);
  const exact = list.find((p) => p.app === pathname);
  if (exact) return exact;
  const prefix = list.filter((p) => pathname.startsWith(p.app.replace(/\/:.*$/, "")) && p.app !== "/").sort((a, b) => b.app.length - a.app.length);
  return prefix[0] ?? null;
}
