import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, LucideIcon } from "lucide-react";

interface Option {
  id: string;
  name: string;
}

interface SingleSelectDropdownProps {
  options: Option[];
  selectedId: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxInitialOptions?: number;
  Icon?: LucideIcon;
  variant?: "default" | "ghost" | "pill";
  // Name read out by screen readers (and used by tests), e.g. "Status"
  ariaLabel?: string;
  // A search box helps long lists; for a handful of choices it's clutter (default: more than 6 options)
  searchable?: boolean;
}

// The app's own dropdown, used everywhere instead of the browser's <select>. Keyboard: Tab to it,
// Enter/Space/↓ opens, ↑/↓ moves, Enter picks, Esc closes; focus returns to the dropdown afterwards.
export function SingleSelectDropdown({
  options,
  selectedId,
  onChange,
  placeholder = "Select an option...",
  disabled = false,
  maxInitialOptions,
  Icon,
  variant = "default",
  ariaLabel,
  searchable
}: SingleSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, up: false });
  const listId = useId();
  const showSearch = searchable ?? options.length > 6;

  const filteredOptions = options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));
  const displayOptions = maxInitialOptions && !search ? filteredOptions.slice(0, maxInitialOptions) : filteredOptions;
  const selectedOption = options.find((o) => o.id === selectedId);

  // Position under the trigger, or above it when there isn't room below (phones, bottom of the page)
  useEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const room = window.innerHeight - r.bottom;
      const up = room < 300 && r.top > room;
      setCoords({ top: up ? r.top + window.scrollY : r.bottom + window.scrollY, left: r.left + window.scrollX, width: Math.max(r.width, 180), up });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!document.contains(target)) return;
      if (!triggerRef.current?.contains(target) && !popupRef.current?.contains(target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  // Start on the chosen option. Without a search box focus stays on the trigger (ARIA combobox pattern),
  // so keys pressed the instant it opens are never lost to a focus hand-off
  useEffect(() => {
    if (isOpen) setActive(Math.max(0, displayOptions.findIndex((o) => o.id === selectedId)));
  }, [isOpen]);

  useEffect(() => setActive(0), [search]);

  const open = () => {
    if (disabled) return;
    setSearch("");
    setIsOpen(true);
  };
  const close = (refocus = true) => {
    setIsOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (id: string) => {
    onChange(id);
    close();
  };

  const onListKeys = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, displayOptions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(displayOptions.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); const o = displayOptions[active]; if (o) pick(o.id); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(false);
  };

  useEffect(() => {
    if (isOpen) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, isOpen]);

  const triggerClass =
    variant === "ghost"
      ? "w-full h-[42px] flex items-center cursor-pointer overflow-hidden bg-transparent border-none rounded-lg"
      : variant === "pill"
        ? `inline-flex h-9 items-center cursor-pointer rounded-full border bg-white dark:bg-slate-900 text-sm font-semibold ${isOpen ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-700"}`
        : `w-full bg-white dark:bg-slate-900 border ${isOpen ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-800"} rounded-lg transition-all h-[42px] flex items-center cursor-pointer overflow-hidden`;

  return (
    <div className={`relative ${variant === "pill" ? "inline-block" : "w-full"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <div
        ref={triggerRef}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-disabled={disabled || undefined}
        aria-activedescendant={isOpen && !showSearch && displayOptions[active] ? `${listId}-${active}` : undefined}
        className={`${triggerClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(e) => {
          if (!isOpen && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); open(); }
          else if (isOpen) onListKeys(e);
        }}
      >
        {Icon && (
          <div className="pl-4 pr-1 shrink-0 text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        {!selectedOption ? (
          <span className={`text-slate-500 dark:text-slate-400 text-sm truncate ${Icon ? "pl-2" : variant === "pill" ? "pl-3" : "px-4"}`}>{placeholder}</span>
        ) : (
          <div className={`flex-1 flex items-center min-w-0 ${Icon ? "pl-2" : variant === "pill" ? "pl-3" : "px-4"}`}>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{selectedOption.name}</span>
          </div>
        )}
        <div className={`ml-auto shrink-0 transition-all ${variant === "pill" ? "pl-1 pr-3" : "pr-4"} ${variant === "ghost" ? "text-inherit" : "text-slate-400"}`}>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {isOpen && !disabled && createPortal(
        <div
          ref={popupRef}
          style={{ position: "absolute", top: `${coords.top}px`, left: `${coords.left}px`, width: `${coords.width}px`, transform: coords.up ? "translateY(-100%)" : undefined }}
          className={`z-[9999] ${coords.up ? "-mt-2" : "mt-2"} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        >
          {showSearch && (
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search options..."
                  aria-label={`Search ${ariaLabel ?? "options"}`}
                  aria-controls={listId}
                  aria-activedescendant={displayOptions[active] ? `${listId}-${active}` : undefined}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={onListKeys}
                  autoFocus
                />
              </div>
            </div>
          )}

          <div
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-60 overflow-y-auto p-2 custom-scrollbar overscroll-contain focus:outline-none"
          >
            {displayOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">No results found</div>
            ) : (
              displayOptions.map((option, i) => {
                const isSelected = selectedId === option.id;
                return (
                  <div
                    key={option.id || "__empty"}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pick(option.id); }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : i === active ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="text-sm font-medium">{option.name}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
