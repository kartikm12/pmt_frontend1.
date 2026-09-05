import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X, LucideIcon } from "lucide-react";

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
  variant?: "default" | "ghost";
}

export function SingleSelectDropdown({ 
  options, 
  selectedId, 
  onChange, 
  placeholder = "Select an option...",
  disabled = false,
  maxInitialOptions,
  Icon,
  variant = "default"
}: SingleSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    function handleScrollResize() {
      if (isOpen && dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    }

    if (isOpen) {
      handleScrollResize();
      window.addEventListener("scroll", handleScrollResize, true);
      window.addEventListener("resize", handleScrollResize);
    }

    return () => {
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
    };
  }, [isOpen]);

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

    document.addEventListener("click", handleClickOutside);
    
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    setSearch("");
  };

  const selectedOption = options.find(o => o.id === selectedId);
  const filteredOptions = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
  
  const displayOptions = (maxInitialOptions && !search) 
    ? filteredOptions.slice(0, maxInitialOptions) 
    : filteredOptions;

  const selectOption = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onChange(id);
    setIsOpen(false);
  };

  const clearSelection = (e: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onChange("");
  };

  return (
    <div className={`relative w-full ${disabled ? "opacity-60 cursor-not-allowed" : ""}`} ref={dropdownRef}>
      <div 
        className={variant === "ghost" 
          ? "w-full h-[42px] flex items-center cursor-pointer overflow-hidden bg-transparent border-none"
          : `w-full bg-white dark:bg-slate-900 border ${
            isOpen ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-800"
          } rounded-lg transition-all h-[42px] flex items-center cursor-pointer overflow-hidden`
        }
        onClick={toggleOpen}
      >
        {Icon && (
          <div className="pl-4 pr-1 shrink-0 text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        {!selectedOption ? (
          <span className={`text-slate-500 dark:text-slate-400 text-sm truncate ${Icon ? "pl-2" : "px-4"}`}>{placeholder}</span>
        ) : (
          <div className={`flex-1 flex items-center min-w-0 ${Icon ? "pl-2" : "px-4"}`}>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {selectedOption.name}
            </span>
          </div>
        )}
        <div className={`ml-auto pr-4 shrink-0 transition-all ${variant === "ghost" ? "text-inherit" : "text-slate-400"}`}>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {isOpen && !disabled && createPortal(
        <div 
          ref={popupRef}
          style={{
            position: "absolute",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`
          }}
          className="z-[9999] mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search options..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto p-2 custom-scrollbar overscroll-contain">
            {displayOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">No results found</div>
            ) : (
              displayOptions.map(option => {
                const isSelected = selectedId === option.id;
                return (
                  <div 
                    key={option.id}
                    onMouseDown={(e) => selectOption(option.id, e)}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
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
