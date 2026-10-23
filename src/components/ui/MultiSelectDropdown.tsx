import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

interface Option {
  id: string;
  name: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  // What the field is for, read out by screen readers (e.g. "Project team")
  ariaLabel?: string;
}

export function MultiSelectDropdown({
  options,
  selectedIds,
  onChange,
  placeholder = "Select users...",
  disabled = false,
  ariaLabel
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // The list is drawn on top of the page (not inside a form that scrolls and would cut it off), below the
  // field when there is room and above it when there isn't
  const [coords, setCoords] = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: 0 });
  const place = () => {
    const r = dropdownRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < 320 && r.top > below;
    setCoords(up ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 8 } : { left: r.left, width: r.width, top: r.bottom + 8 });
  };
  useLayoutEffect(() => {
    if (!isOpen) return;
    place();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setIsOpen(false); } };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    // Capture phase: Escape closes this list first, not the form around it
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [isOpen, selectedIds.length]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!document.contains(target)) return;

      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        popupRef.current && !popupRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    setSearch("");
  };

  const selectedOptions = selectedIds.map(id => options.find(o => o.id === id)).filter(Boolean) as Option[];
  const filteredOptions = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  const toggleOption = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeOption = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter(selectedId => selectedId !== id));
  };

  return (
    <div className={`relative w-full ${disabled ? "opacity-60 cursor-not-allowed" : ""}`} ref={dropdownRef}>
      <div
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        className={`min-h-[46px] w-full bg-white dark:bg-slate-900 border ${isOpen ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-800"} rounded-xl transition-all p-2 flex flex-wrap gap-2 items-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
        onClick={toggleOpen}
        onKeyDown={(e) => { if (!isOpen && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) { e.preventDefault(); toggleOpen(); } }}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-slate-400 text-sm px-2 py-1">{placeholder}</span>
        ) : (
          selectedOptions.map(option => (
            <span
              key={option.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20"
            >
              {option.name}
              <button
                type="button"
                onClick={(e) => removeOption(option.id, e)}
                aria-label={`Remove ${option.name}`}
                className="w-6 h-6 -my-1 -mr-1.5 flex items-center justify-center hover:bg-indigo-200 dark:hover:bg-indigo-500/30 rounded-full transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
        <div className="ml-auto pr-2 text-slate-400">
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {isOpen && !disabled && createPortal(
        <div
          ref={popupRef}
          style={{ position: "fixed", left: coords.left, width: coords.width, top: coords.top, bottom: coords.bottom }}
          className="z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search team members..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>

          <div role="listbox" aria-multiselectable="true" aria-label={ariaLabel} className="max-h-60 overflow-y-auto p-2 custom-scrollbar overscroll-contain">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">No results found</div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = selectedIds.includes(option.id);
                return (
                  <div
                    key={option.id}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onClick={(e) => {
                      toggleOption(option.id, e);
                      // keep open after clicking so user can select multiple
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleOption(option.id); } }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
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
