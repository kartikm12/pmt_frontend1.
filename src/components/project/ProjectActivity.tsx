import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ActivityTimeline } from "@/components/reports/ActivityTimeline";

// Everything that happened in one project, newest first (same list component Reports uses)
export function ProjectActivity({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(null);
    api.getAuditLog({ projectId, limit: 100 }).then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load activity"));
  }, [projectId]);

  if (error) return <div className="card p-8 text-red-600">{error}</div>;
  if (!items) return <div className="card p-8 text-slate-500">Loading activity...</div>;
  return <ActivityTimeline data={items} subtitle="Everything that happened in this project" />;
}
