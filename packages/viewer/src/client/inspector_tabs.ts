/** Shared disclosure preference, keyboard navigation and focus for inspector tabs. */
import { createBrowserDetailsPreference } from "./browse_details.js";
import { installInspectorResize } from "./inspector_resize.js";

export function installInspectorTabs(
  root: HTMLElement,
  signal: AbortSignal,
  doc: Document = root.ownerDocument,
) {
  const win = doc.defaultView!;
  const preference = createBrowserDetailsPreference(
    win as Window & typeof globalThis,
  );
  const inspector = root.querySelector<HTMLElement>(
    "[data-workspace-inspector]",
  )!;
  const content = root.querySelector<HTMLElement>(".mbk-inspector-content")!;
  const clamp = installInspectorResize(root, signal);
  let active: string | undefined;
  const button = (value: string | undefined) =>
    value
      ? root.querySelector<HTMLElement>(`[data-inspector-tab="${value}"]`)
      : undefined;
  const open = (value: string | undefined, persist = true) => {
    active = value;
    inspector.dataset["open"] = String(value !== undefined);
    content.hidden = value === undefined;
    for (const tab of root.querySelectorAll<HTMLElement>(
      "[data-inspector-tab]",
    ))
      tab.setAttribute(
        "aria-selected",
        String(tab.dataset["inspectorTab"] === value),
      );
    for (const panel of root.querySelectorAll<HTMLElement>(
      "[data-inspector-panel]",
    ))
      panel.hidden = panel.dataset["inspectorPanel"] !== value;
    root.querySelector<HTMLElement>("[data-inspector-title]")!.textContent =
      button(value)?.getAttribute("aria-label") ?? "";
    root.querySelector<HTMLElement>("[data-inspector-close]")!.hidden = !value;
    clamp();
    if (persist) preference.remember(value !== undefined);
  };
  const close = () => {
    const previous = active;
    open(undefined);
    button(previous)?.focus({ preventScroll: true });
  };
  root.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element;
      const tab = target.closest<HTMLElement>("[data-inspector-tab]");
      if (tab)
        open(
          active === tab.dataset["inspectorTab"]
            ? undefined
            : tab.dataset["inspectorTab"],
        );
      if (target.closest("[data-inspector-close]")) close();
    },
    { signal },
  );
  root.addEventListener(
    "keydown",
    (event) => {
      const target = event.target as HTMLElement;
      if (
        !target.matches("[data-inspector-tab]") ||
        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      )
        return;
      event.preventDefault();
      const tabs = [
        ...root.querySelectorAll<HTMLElement>("[data-inspector-tab]"),
      ];
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (tabs.indexOf(target) +
                (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
              tabs.length;
      tabs[next]?.focus();
    },
    { signal },
  );
  doc.addEventListener(
    "mokly:inspector-restore",
    () =>
      open(inspector.dataset["open"] === "true" ? "details" : undefined, false),
    { signal },
  );
  return {
    open,
    close,
    active: () => active,
    preferredOpen: preference.preferredOpen,
  };
}
