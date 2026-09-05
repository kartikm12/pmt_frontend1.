import React, { useState, useRef, useEffect } from "react";
import { Bell, Menu, Sun, Moon, LogOut, User as UserIcon, Settings, Shield, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { Notification } from "@/lib/api-types";
import { safeFormat } from "@/utils/dateUtils";
import { toast } from "sonner";
import { useNotifications } from "@/context/NotificationContext";
import { Avatar } from "@/components/ui/Avatar";

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { currentUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();
  
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    try {
      if (!n.isRead) {
        await markAsRead(n.id);
      }
      
      setIsNotificationsOpen(false);
      
      if (n.taskId) {
        navigate(`/tasks/${n.taskId}`);
      } else if (n.projectId) {
        navigate(`/projects/${n.projectId}`);
      }
    } catch (error) {
      console.error("Failed to process notification click", error);
    }
  };

  // unreadCount is now coming from useNotifications()
  const recentNotifications = notifications.slice(0, 5); // display only top 5 in dropdown

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 md:px-10 sticky top-0 z-40 transition-all duration-300">
      <div className="flex items-center gap-6 flex-1">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-4 md:gap-8">
        <div className="hidden sm:block w-px h-8 bg-black/10 dark:bg-white/10" />
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`relative p-2 rounded-lg transition-all active:scale-95 ${
                isNotificationsOpen 
                  ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" 
                  : "text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-600 text-white text-[10px] font-black rounded-full border-2 border-white dark:border-slate-900 shadow-lg shadow-red-500/20 px-1 transform translate-x-1 -translate-y-1">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {isNotificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-4 z-50 overflow-hidden"
                >
                  <div className="px-6 pb-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                    {unreadCount > 0 ? (
                      <button 
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-500 transition-colors"
                      >
                        Mark all as read
                      </button>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">All read</span>
                    )}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {recentNotifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">No notifications yet.</div>
                    ) : (
                      recentNotifications.map((n) => (
                        <button 
                          key={n.id} 
                          onClick={() => handleNotificationClick(n)}
                          className={`w-full text-left px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0 group ${!n.isRead ? "bg-indigo-50/30 dark:bg-indigo-900/10" : ""}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className={`text-sm font-bold ${n.isRead ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"}`}>{n.title}</p>
                            <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-2">{safeFormat(n.createdAt, "MMM d, h:mm a")}</span>
                          </div>
                          <p className={`text-xs line-clamp-2 ${n.isRead ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}>{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                  <button 
                    onClick={() => { navigate("/notifications"); setIsNotificationsOpen(false); }}
                    className="w-full py-3 text-xs font-bold text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    View All Notifications
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 p-1 pl-3 rounded-xl transition-all text-left group border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
          <div className="text-right hidden lg:block">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{currentUser.name}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">{currentUser.role}</p>
          </div>
          <div className="relative">
            <Avatar name={currentUser.name} src={currentUser.avatar} className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-800 object-cover shadow-md group-hover:scale-110 transition-transform duration-300" />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
          </div>
        </div>
      </div>
    </header>
  );
}


