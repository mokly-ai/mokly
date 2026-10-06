/** Live-update and recovery adapters for the React host capability boundary. */

import {
  readViewerCapabilityDescriptor,
  readViewerRouteEvidenceRevision,
  viewerCapabilityRequestMatches,
} from "@mokly/viewer/runtime";
import type {
  BrowseRecoveryState,
  ShellRecoverySnapshot,
  ViewerCapabilityDescriptor,
  ViewerCapabilityRequest,
  ViewerUpdateActions,
} from "@mokly/viewer/runtime";

import type {
  ReactCapabilityEnvironment,
  ReactCapabilityEventSource,
} from "./react_capabilities.js";
import {
  ReactUpdateController,
  type UpdateEventStream,
} from "./react_update_controller.js";

/** Build the watched-update capability while keeping unavailable transports optional. */
export function createReactUpdateCapability(
  descriptor: ViewerCapabilityDescriptor,
  environment: ReactCapabilityEnvironment,
) {
  const requireCurrent = (request: ViewerCapabilityRequest): void => {
    if (!viewerCapabilityRequestMatches(descriptor.source, request))
      throw new Error("The live viewer source changed.");
  };
  return {
    consumeRecovery(request: ViewerCapabilityRequest) {
      requireCurrent(request);
      try {
        const controller = new ReactUpdateController(
          new EmptyUpdateStream(),
          environment.storage,
          environment.location,
        );
        const recovery = controller.consumeRecovery();
        if (
          !recovery?.browse ||
          recovery.url !== environment.location.href ||
          recovery.version > request.source.updateVersion
        )
          return;
        return shellRecovery(recovery.browse);
      } catch (error) {
        environment.reportError?.(error);
        return;
      }
    },
    subscribe(
      request: ViewerCapabilityRequest,
      actions: ViewerUpdateActions,
      signal: AbortSignal,
    ) {
      requireCurrent(request);
      if (signal.aborted) return;
      let source: ReactCapabilityEventSource | undefined;
      try {
        source = environment.createEventSource("/__mokly/events");
      } catch (error) {
        environment.reportError?.(error);
        return;
      }
      if (!source) return;
      const controller = new ReactUpdateController(
        new EventSourceStream(source),
        environment.storage,
        environment.location,
        () => browseRecovery(actions.captureRecovery()),
        request.source.updateVersion,
        async (version, refreshSignal) => {
          const revision = await refreshEvidence(
            descriptor,
            request,
            version,
            refreshSignal,
            environment,
          );
          if (!revision || !(await actions.adoptEvidence(revision))) return;
          return revision.source.updateVersion;
        },
      );
      let closed = false;
      let stopPageHide = (): void => undefined;
      function close(): void {
        if (closed) return;
        closed = true;
        signal.removeEventListener("abort", close);
        stopPageHide();
        controller.close();
      }
      try {
        const stop = environment.onPageHide(close);
        if (closed) {
          stop();
          return;
        }
        stopPageHide = stop;
        signal.addEventListener("abort", close, { once: true });
        if (signal.aborted) close();
        else controller.start();
      } catch (error) {
        close();
        environment.reportError?.(error);
      }
    },
  };
}

async function refreshEvidence(
  installed: ViewerCapabilityDescriptor,
  request: ViewerCapabilityRequest,
  version: number,
  signal: AbortSignal,
  environment: ReactCapabilityEnvironment,
) {
  const href = environment.location.href;
  const pageUrl = href.split("#")[0]!;
  const response = await environment.fetch(href, {
    signal,
    cache: "no-store",
    headers: { accept: "text/html" },
  });
  const html = await response.text();
  signal.throwIfAborted();
  if (
    !response.ok ||
    response.url !== pageUrl ||
    environment.location.href !== href
  )
    return;
  const nextDocument = environment.parseDocument(html);
  const state = nextDocument.querySelector<HTMLScriptElement>(
    "script[data-mokly-host-capability-state]",
  );
  const publicState = nextDocument.querySelector<HTMLScriptElement>(
    "script[data-mokly-shell-bootstrap]",
  );
  if (!state?.textContent || !publicState?.textContent) return;
  const next = readViewerCapabilityDescriptor(JSON.parse(state.textContent));
  if (
    !viewerCapabilityRequestMatches(installed.source, {
      ...request,
      source: next.source,
    }) ||
    next.source.updateVersion <
      Math.max(version, request.source.updateVersion) ||
    !sameRenderCapability(installed, next)
  )
    return;
  return readViewerRouteEvidenceRevision(
    installed.source,
    request,
    next.source,
    JSON.parse(publicState.textContent),
    next.workspace,
  );
}

function sameRenderCapability(
  current: ViewerCapabilityDescriptor,
  next: ViewerCapabilityDescriptor,
): boolean {
  return (
    current.renderCapability?.generation ===
      next.renderCapability?.generation &&
    current.renderCapability?.token === next.renderCapability?.token
  );
}

function browseRecovery(
  value: ShellRecoverySnapshot | undefined,
): BrowseRecoveryState | undefined {
  if (!value) return;
  const { view, ...snapshot } = value;
  return { ...snapshot, changedOnly: view === "changes" };
}

function shellRecovery(value: BrowseRecoveryState): ShellRecoverySnapshot {
  const { changedOnly, ...snapshot } = value;
  return { ...snapshot, view: changedOnly ? "changes" : "all" };
}

class EventSourceStream implements UpdateEventStream {
  constructor(private readonly source: ReactCapabilityEventSource) {}

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

class EmptyUpdateStream implements UpdateEventStream {
  close(): void {}
  onReady(_callback: (version: number) => void): void {}
  onUpdate(_callback: (version: number) => void): void {}
}
