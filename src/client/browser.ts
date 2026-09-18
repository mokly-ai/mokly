import {
  captureBrowseState,
  restoreBrowseState,
  type BrowseRecoveryState,
} from "@mokly/viewer/runtime";

import { refreshBrowseEvidence } from "./browse_refresh.js";
import {
  LiveUpdateController,
  type RecoveryStorage,
  type ReloadLocation,
  type UpdateEventStream,
} from "./live_updates.js";

/** EventSource subset consumed by the browser adapter. */
export interface BrowserEventSource {
  addEventListener(
    type: "ready" | "update",
    callback: (event: { data: string }) => void,
  ): void;
  close(): void;
}

/** Injectable browser globals used to test the served live-update entry. */
export interface BrowserLiveUpdateEnvironment {
  createEventSource(url: string): BrowserEventSource;
  captureBrowseState(): BrowseRecoveryState | undefined;
  location: ReloadLocation;
  onPageHide(callback: () => void): void;
  pageVersion?: number;
  refresh?(version: number, signal: AbortSignal): Promise<number | undefined>;
  restoreBrowseState(state: BrowseRecoveryState): void;
  storage: RecoveryStorage;
}

/** Connect a served document to Mokly's versioned update stream. */
export function startBrowserLiveUpdates(
  environment: BrowserLiveUpdateEnvironment,
): LiveUpdateController {
  const controller = new LiveUpdateController(
    new EventSourceStream(environment.createEventSource("/__mokly/events")),
    environment.storage,
    environment.location,
    environment.captureBrowseState,
    environment.pageVersion,
    environment.refresh,
  );
  const recovery = controller.consumeRecovery();
  if (recovery?.browse && recovery.url === environment.location.href)
    environment.restoreBrowseState(recovery.browse);
  controller.start();
  environment.onPageHide(() => controller.close());
  return controller;
}

/** Read a valid request-snapshot update version from a served document. */
export function pageUpdateVersion(document: Document): number | undefined {
  const encoded = document.documentElement.getAttribute(
    "data-mokly-update-version",
  );
  if (!encoded || !/^[1-9]\d*$/.test(encoded)) return undefined;
  const version = Number(encoded);
  return Number.isSafeInteger(version) ? version : undefined;
}

class EventSourceStream implements UpdateEventStream {
  constructor(private readonly source: BrowserEventSource) {}

  close(): void {
    this.source.close();
  }

  onReady(callback: (version: number) => void): void {
    this.source.addEventListener("ready", (event) =>
      callback(Number(event.data)),
    );
  }

  onUpdate(callback: (version: number) => void): void {
    this.source.addEventListener("update", (event) =>
      callback(Number(event.data)),
    );
  }
}

if (typeof window !== "undefined" && typeof EventSource !== "undefined") {
  const updateVersion = pageUpdateVersion(document);
  startBrowserLiveUpdates({
    captureBrowseState: () => captureBrowseState(document, window),
    createEventSource: (url) => new EventSource(url),
    location: window.location,
    onPageHide: (callback) =>
      window.addEventListener("pagehide", callback, { once: true }),
    ...(updateVersion ? { pageVersion: updateVersion } : {}),
    refresh: (version, signal) =>
      refreshBrowseEvidence(document, window, version, signal),
    restoreBrowseState: (state) => restoreBrowseState(document, window, state),
    storage: window.sessionStorage,
  });
}
