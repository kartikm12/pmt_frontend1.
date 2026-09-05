import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Trash2, Calendar, Layout, CheckCircle2, AlertCircle, Info, Mail } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Notification, NotificationType } from "@/lib/api-types";
import { useNotifications } from "@/context/NotificationContext";
import { safeFormat } from "@/utils/dateUtils";

export function Notifications() {
  const navigate = useNavigate();
  const { 
    notifications, 
    isLoading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filteredNotifications = notifications.filter((n) => filter === "all" || !n.isRead);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
      toast.success("Marked as read");
    } catch (error) {
      // toast.error handled in context
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      toast.success("All notifications marked as read");
    } catch (error) {
      // toast.error handled in context
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      toast.success("Notification deleted");
    } catch (error) {
      // toast.error handled in context
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    try {
      if (!n.isRead) {
        await markAsRead(n.id);
      }
      
      if (n.taskId) {
        navigate(`/tasks/${n.taskId}`);
      } else if (n.projectId) {
        navigate(`/projects/${n.projectId}`);
      }
    } catch (error) {
      console.error("Failed to process notification click", error);
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case "TASK_ASSIGNED":
        return <Layout className="w-5 h-5 text-indigo-500" />;
      case "TASK_DUE_SOON":
      case "TASK_OVERDUE":
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case "COMMENT_MENTION":
        return <Mail className="w-5 h-5 text-blue-500" />;
      case "PROJECT_UPDATED":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default:
        return <Info className="w-5 h-5 text-slate-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Notifications</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Keep track of updates and mentions.</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllAsRead} className="flex items-center gap-2 px-5 py-2.5 btn-secondary text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30">
              <Check className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-fit">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label="All" count={notifications.length} />
        <FilterButton active={filter === "unread"} onClick={() => setFilter("unread")} label="Unread" count={unreadCount} />
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredNotifications.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 card bg-transparent border-dashed">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">All caught up!</h3>
              <p className="text-slate-500 dark:text-slate-400">No notifications to show here.</p>
            </motion.div>
          ) : (
            filteredNotifications.map((n) => (
              <motion.div 
                key={n.id} 
                layout 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95 }} 
                onClick={() => handleNotificationClick(n)}
                className={`card p-6 flex gap-5 transition-all group cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-900/50 ${!n.isRead ? "border-l-4 border-l-indigo-600 bg-indigo-50/10 dark:bg-indigo-900/5" : ""}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className={`font-bold transition-colors ${!n.isRead ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
                      {n.title}
                    </h3>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {safeFormat(n.createdAt, "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>
                  <p className={`text-sm leading-relaxed ${!n.isRead ? "text-slate-700 dark:text-slate-300" : "text-slate-500 dark:text-slate-500"}`}>
                    {n.message}
                  </p>
                  {(n.project || n.task) && (
                    <div className="flex gap-4 mt-3">
                      {n.project && (
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-md">
                          #{n.project.name}
                        </div>
                      )}
                      {n.task && (
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                          Task: {n.task.title}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!n.isRead && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleMarkAsRead(n.id); }} 
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" 
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }} 
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" 
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${active ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
        {count}
      </span>
    </button>
  );
}
