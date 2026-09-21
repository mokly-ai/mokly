/** Live Serve entry that supplies capabilities before starting React hydration. */

import { hydrateMoklyShell } from "@mokly/viewer/browser";
import { readViewerCapabilityDescriptor } from "@mokly/viewer/runtime";
import type { ViewerHostCapabilities } from "@mokly/viewer/runtime";

import { createReactViewerCapabilities } from "./react_capabilities.js";
import type { RecoveryStorage } from "./react_update_controller.js";

/** Browser surface used by the live host bootstrap. */
export interface ReactHostWindow {
  DOMParser: typeof DOMParser;
  EventSource?: typeof EventSource;
  addEventListener(
    type: "pagehide",
    callback: () => void,
    options: { once: true },
  ): void;
  console: Pick<Console, "warn">;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  location: Location;
  removeEventListener(type: "pagehide", callback: () => void): void;
  readonly sessionStorage: Storage;
}

/** Hydrate a marked live document even when optional browser transports fail. */
export function startReactHost(
  doc: Document,
  win: ReactHostWindow,
  hydrate: (
    doc: Document,
    capabilities: ViewerHostCapabilities,
  ) => void = hydrateMoklyShell,
): void {
  const state = doc.querySelector<HTMLScriptElement>(
    "script[data-mokly-host-capability-state]",
  );
  if (!state?.textContent)
    throw new Error("Live viewer capabilities are unavailable.");
  const descriptor = readViewerCapabilityDescriptor(
    JSON.parse(state.textContent),
  );
  const reportError = (error: unknown) =>
    win.console.warn("Mokly live updates are unavailable.", error);
  const capabilities = createReactViewerCapabilities(descriptor, {
    createEventSource(url) {
      if (!win.EventSource) return;
      return new win.EventSource(url);
    },
    fetch: (input, init) => win.fetch(input, init),
    location: win.location,
    onPageHide(callback) {
      win.addEventListener("pagehide", callback, { once: true });
      return () => win.removeEventListener("pagehide", callback);
    },
    parseDocument: (html) =>
      new win.DOMParser().parseFromString(html, "text/html"),
    reportError,
    storage: safeRecoveryStorage(win, reportError),
  });
  hydrate(doc, capabilities);
}

function safeRecoveryStorage(
  win: ReactHostWindow,
  reportError: (error: unknown) => void,
): RecoveryStorage {
  let storage: Storage | undefined;
  try {
    storage = win.sessionStorage;
  } catch (error) {
    reportError(error);
  }
  return {
    getItem(key) {
      try {
        return storage?.getItem(key) ?? null;
      } catch (error) {
        reportError(error);
        return null;
      }
    },
    removeItem(key) {
      try {
        storage?.removeItem(key);
      } catch (error) {
        reportError(error);
      }
    },
    setItem(key, value) {
      try {
        storage?.setItem(key, value);
      } catch (error) {
        reportError(error);
      }
    },
  };
}

if (typeof document !== "undefined" && typeof window !== "undefined")
  startReactHost(document, window);
