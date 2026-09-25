import { useSyncExternalStore } from "react";

// True while the media query matches (false during server render). Used where a layout switch must not depend on generated CSS.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", notify);
      return () => m.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
