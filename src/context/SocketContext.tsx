import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { forgetKept, getStoredToken } from "@/lib/api";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const activeProjectsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const token = getStoredToken();

    if (currentUser && token) {
      // Determine socket URL: use explicit env var, or derive from API URL, or fallback to localhost
      const getSocketUrl = () => {
        if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
        if (import.meta.env.VITE_API_URL) {
          // Strip /api suffix to get base URL (e.g. https://pmt-backend.onrender.com/api -> https://pmt-backend.onrender.com)
          return import.meta.env.VITE_API_URL.replace(/\/+$/, '').replace(/\/api$/, '');
        }
        const hostname = window.location.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1'
          ? `http://${hostname}:4000`
          : '/';
      };

      const newSocket = io(getSocketUrl(), {
        auth: { token },
        reconnection: true,
        // Keep trying (waits grow to 10 s): a deploy or a sleeping free-tier server takes longer than
        // the old 5 attempts (~20 s), after which live updates silently stopped until a page refresh
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000
      });

      newSocket.onAny(() => forgetKept());

      // Only a REconnect drops the kept lists (live events may have been missed while cut off). The first
      // connect lands a few seconds after the first page loaded its lists; nothing was missed then.
      let connectedBefore = false;
      newSocket.on("connect", () => {
        if (connectedBefore) forgetKept();
        connectedBefore = true;
        console.log("Connected to WebSocket");
        setIsConnected(true);
        activeProjectsRef.current.forEach((projectId) => {
          newSocket.emit("join_project", projectId);
        });
      });

      newSocket.on("disconnect", () => {
        console.log("Disconnected from WebSocket");
        setIsConnected(false);
      });

      newSocket.on("connect_error", (err) => {
        console.error("Socket connection error:", err.message);
      });

      newSocket.on("force_logout", (payload: { message?: string }) => {
        const message = payload?.message || "Your account was logged in from another device.";
        logout({ skipServer: true, message });
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      };
    } else {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [currentUser, logout]);

  const joinProject = (projectId: string) => {
    activeProjectsRef.current.add(projectId);
    if (socketRef.current?.connected) {
      socketRef.current.emit("join_project", projectId);
    }
  };

  const leaveProject = (projectId: string) => {
    activeProjectsRef.current.delete(projectId);
    if (socketRef.current?.connected) {
      socketRef.current.emit("leave_project", projectId);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, joinProject, leaveProject }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
