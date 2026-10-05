/** CLI-owned live capabilities passed into the hydrated React shell. */

import {
  readInteractivePrepareResponse,
  readViewerCapabilityDescriptor,
  readViewerRouteEvidenceRevision,
  sameViewerInteractiveOrigin,
  viewerCapabilityRequestMatches,
  viewerCapabilitySourceEquals,
} from "@mokly/viewer/runtime";
import type {
  ViewerCapabilityDescriptor,
  ViewerCapabilityRequest,
  ViewerHostCapabilities,
} from "@mokly/viewer/runtime";

import { createReactUpdateCapability } from "./react_capability_updates.js";
import {
  componentPreviewExpired,
  requestComponentPreview,
  workspaceLoader,
} from "./react_transports.js";
import type {
  RecoveryStorage,
  ReloadLocation,
} from "./react_update_controller.js";

/** EventSource subset needed by the live update adapter. */
export interface ReactCapabilityEventSource {
  addEventListener(
    type: "interactive" | "ready" | "rebuild" | "update",
    callback: (event: { data: string }) => void,
  ): void;
  close(): void;
}

/** Injectable browser boundary for focused capability tests. */
export interface ReactCapabilityEnvironment {
  createEventSource(url: string): ReactCapabilityEventSource | undefined;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  location: ReloadLocation;
  onPageHide(callback: () => void): () => void;
  parseDocument(html: string): Document;
  reportError?(error: unknown): void;
  storage: RecoveryStorage;
}

/** Private transports supplied to the live shell capability boundary. */
export interface ReactCapabilityTransports {
  componentPreviewExpired: typeof componentPreviewExpired;
  requestComponentPreview: typeof requestComponentPreview;
  workspaceLoader: typeof workspaceLoader;
}

const defaultTransports: ReactCapabilityTransports = {
  componentPreviewExpired,
  requestComponentPreview,
  workspaceLoader,
};

/** Compose the real Serve transports without exposing tokens to React state. */
export function createReactViewerCapabilities(
  descriptor: ViewerCapabilityDescriptor,
  environment: ReactCapabilityEnvironment,
  transports: ReactCapabilityTransports = defaultTransports,
): ViewerHostCapabilities {
  const source = descriptor.source;
  const requireCurrent = (request: ViewerCapabilityRequest): void => {
    if (!viewerCapabilityRequestMatches(source, request))
      throw new Error("The live viewer source changed.");
  };
  const updates = createReactUpdateCapability(descriptor, environment);
  const renderCapability = descriptor.renderCapability;
  const interactive = descriptor.interactive;
  return {
    evidence: {
      initialWorkspace(request) {
        if (!viewerCapabilitySourceEquals(source, request.source))
          throw new Error("The live viewer source changed.");
        const workspace = descriptor.workspace;
        if (workspace && workspace.entry.path !== request.entryPath)
          throw new Error("The live workspace changed.");
        return workspace;
      },
      loadRouteEvidence(request, signal) {
        requireCurrent(request);
        return loadRouteEvidence(descriptor, request, signal, environment);
      },
    },
    source,
    updates,
    ...(interactive
      ? {
          interactive: {
            async prepare(request, generation, signal) {
              requireCurrent(request);
              if (generation !== interactive.generation)
                throw new Error("The live preview generation changed.");
              const endpoint = new URL(
                `/__mokly/interactive/${generation}/prepare`,
                environment.location.href,
              );
              const response = await environment.fetch(endpoint, {
                cache: "no-store",
                method: "POST",
                signal,
              });
              const result = readInteractivePrepareResponse(
                await response.json(),
              );
              if (
                result.generation !== generation ||
                !(
                  (response.status === 200 && result.state === "ready") ||
                  (response.status === 503 && result.state === "failed")
                )
              )
                throw new Error("Invalid live preview preparation response.");
              return result;
            },
          },
        }
      : {}),
    ...(source.previewGeneration
      ? {
          onDemand: {
            loadWorkspace(request, data, signal, changed) {
              requireCurrent(request);
              if (
                request.entryPath !== data.entry.path ||
                data.previewGeneration !== source.previewGeneration
              )
                throw new Error("The live workspace changed.");
              return transports.workspaceLoader(data, signal, changed);
            },
          },
        }
      : {}),
    ...(renderCapability
      ? {
          temporaryPreviews: {
            expired(request, frame, previews, signal) {
              requireCurrent(request);
              return transports.componentPreviewExpired(
                frame,
                previews,
                signal,
              );
            },
            render(request, input, view, signal) {
              requireCurrent(request);
              if (input.generation !== renderCapability.generation)
                return Promise.reject(
                  new Error("The live component renderer changed."),
                );
              return transports.requestComponentPreview(
                input,
                renderCapability,
                view,
                signal,
              );
            },
          },
        }
      : {}),
  };
}

async function loadRouteEvidence(
  installed: ViewerCapabilityDescriptor,
  request: ViewerCapabilityRequest,
  signal: AbortSignal,
  environment: ReactCapabilityEnvironment,
) {
  signal.throwIfAborted();
  const href = environment.location.href;
  const response = await environment.fetch(href, {
    signal,
    cache: "no-store",
    headers: { accept: "text/html" },
  });
  const html = await response.text();
  signal.throwIfAborted();
  if (
    !response.ok ||
    response.url !== href.split("#")[0] ||
    environment.location.href !== href
  )
    return;
  const nextDocument = environment.parseDocument(html);
  const publicState = nextDocument.querySelector<HTMLScriptElement>(
    "script[data-mokly-shell-bootstrap]",
  );
  const privateState = nextDocument.querySelector<HTMLScriptElement>(
    "script[data-mokly-host-capability-state]",
  );
  if (!publicState?.textContent || !privateState?.textContent) return;
  const next = readViewerCapabilityDescriptor(
    JSON.parse(privateState.textContent),
  );
  if (
    !sameRenderCapability(installed, next) ||
    (next.workspace && next.workspace.entry.path !== request.entryPath)
  )
    return;
  return readViewerRouteEvidenceRevision(
    installed.source,
    request,
    next.source,
    JSON.parse(publicState.textContent),
    next.workspace,
    next.interactive,
    next.rebuildStatus,
  );
}

function sameRenderCapability(
  current: ViewerCapabilityDescriptor,
  next: ViewerCapabilityDescriptor,
): boolean {
  return (
    current.renderCapability?.generation ===
      next.renderCapability?.generation &&
    current.renderCapability?.token === next.renderCapability?.token &&
    sameViewerInteractiveOrigin(current.interactive, next.interactive)
  );
}
