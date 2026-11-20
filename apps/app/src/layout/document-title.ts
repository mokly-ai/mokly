import { useEffect } from "react";

const suffix = " · Mokly";

/**
 * Name the page in the tab, the history entry and the bookmark. Every screen
 * sets its own, so a reader with several Mokly tabs can tell them apart. The
 * suffix is always added, because the screen names the page and this names the
 * product; a screen whose own heading already says Mokly passes the shorter
 * route name here instead. An empty title means this screen is not the one
 * naming the document — the surface layered over it is.
 */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!title) return;
    document.title = title + suffix;
  }, [title]);
}
