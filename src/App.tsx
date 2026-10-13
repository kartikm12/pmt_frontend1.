/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import { Toaster } from "sonner";
import { MainLayout } from "./components/layout/MainLayout";
import { Login } from "./pages/Login";
import { Pages } from "./pages/lazyPages";

const { Dashboard, Projects, ProjectDetails, Tasks, TaskDetails, Reports, Leaderboard, Team, Settings, Notifications, Calendar, Trash, AuditLog } = Pages;
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NavigationProvider } from "./context/NavigationContext";
import { SocketProvider, useSocket } from "./context/SocketContext";
import { NotificationProvider } from "./context/NotificationContext";
import { toast } from "sonner";
import { useEffect } from "react";

function AppRoutes() {
  const { currentUser, logout, isLoading } = useAuth();
  const { socket } = useSocket();
  const isAuthenticated = !!currentUser;



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <Login />
        } 
      />
      <Route 
        path="/" 
        element={
          isAuthenticated ? <MainLayout onLogout={logout} /> : <Navigate to="/login" replace />
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetails />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:id" element={<TaskDetails />} />
        <Route path="reports" element={<Reports />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="team" element={<Team />} />
        <Route path="settings" element={<Settings />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="trash" element={<Trash />} />
        <Route path="audit" element={<AuditLog />} />
        {/* Unknown addresses used to render an empty page */}
        <Route
          path="*"
          element={
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Page not found</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">This address doesn't match any page.</p>
              <Link to="/" className="inline-block mt-4 text-indigo-600 font-medium">Go to Dashboard</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <NavigationProvider>
              <Router>
                <Toaster position="top-right" richColors />
                <AppRoutes />
              </Router>
            </NavigationProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
