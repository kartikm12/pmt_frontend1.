import React, { createContext, useContext, useState, useCallback } from "react";

interface NavigationContextType {
  entityNames: Record<string, string>;
  setEntityName: (id: string, name: string) => void;
  getEntityName: (id: string) => string | undefined;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});

  const setEntityName = useCallback((id: string, name: string) => {
    setEntityNames((prev) => {
      if (prev[id] === name) return prev;
      return { ...prev, [id]: name };
    });
  }, []);

  const getEntityName = useCallback((id: string) => {
    return entityNames[id];
  }, [entityNames]);

  return (
    <NavigationContext.Provider value={{ entityNames, setEntityName, getEntityName }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
}
