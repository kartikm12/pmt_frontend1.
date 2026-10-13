import { useEffect, useState } from "react";

// True while the screen matches the query (e.g. "(min-width: 768px)"); updates on resize/rotate.
// Used where phones get a different layout (cards instead of a table), so only one version is rendered.
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}
