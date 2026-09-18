/** Preserve native navigation choices while the enhancement modules are loading. */
import { createBrowserNavPreference } from "./browse_navigation.js";

const attribute = "data-mokly-early-disclosure";

/** Attach in the synchronous bootstrap, before deferred preference restoration. */
export function captureEarlyDisclosures(
  doc: Document,
  win: Window & typeof globalThis,
): void {
  if (doc.readyState === "complete") return;
  const controller = new win.AbortController();
  const signal = controller.signal;
  const touched = new Set<HTMLDetailsElement>();
  doc.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : undefined;
      if (target?.closest("a,button,input,select,textarea,label")) return;
      const group = target?.closest("summary")?.parentElement;
      if (
        !(group instanceof HTMLDetailsElement) ||
        !group.hasAttribute("data-nav-disclosure")
      )
        return;
      group.setAttribute(attribute, group.open ? "closed" : "open");
      touched.add(group);
    },
    { signal },
  );
  const finish = (event: Event): void => {
    if (
      event.type === "load" &&
      [...touched].some((group) => group.isConnected)
    ) {
      restoreEarlyDisclosures(doc);
      if (!doc.querySelector("[data-nav-disclosure][data-filter-open]"))
        createBrowserNavPreference(win).remember(doc);
    }
    controller.abort();
    for (const group of touched) group.removeAttribute(attribute);
    touched.clear();
  };
  win.addEventListener("load", finish, { once: true, signal });
  win.addEventListener("pagehide", finish, { once: true, signal });
}

/** A native activation is newer than any pre-reload preference or snapshot. */
export function restoreEarlyDisclosures(doc: Document): void {
  for (const group of doc.querySelectorAll<HTMLDetailsElement>(
    `details[${attribute}]`,
  )) {
    const state = group.getAttribute(attribute);
    if (state === "open" || state === "closed") group.open = state === "open";
  }
}
