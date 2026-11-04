import type { CatalogueUsage } from "@mokly/model";

import type {
  FrameEvent,
  InstanceBoundary,
  MountedFrame,
} from "../frame_adapter.js";

import { FrameError } from "./frame_error.js";
import { ownFrame } from "./frame_mount.js";
import { localFrameAccess } from "./same_origin_access.js";
import {
  assignedFrameResource,
  createMountAuthentication,
  type AuthenticatedDocument,
  type MountAuthentication,
} from "./same_origin_identity.js";
import { initialFrameLoad } from "./same_origin_load.js";
import { listenForFrameActivations } from "./same_origin_navigation.js";

interface LocalOperations {
  updateUsage(usage: CatalogueUsage): void;
  list(): readonly InstanceBoundary[];
  highlight(keys: readonly string[], mode: "off" | "highlight" | "pick"): void;
  scroll(key: string): void;
  subscribe(enabled: boolean): void;
  dispose(): void;
}

/** Load/session ownership, with no probe handshake or consumer script permission. */
export function mountLocalDocument(
  frame: HTMLIFrameElement,
  url: URL,
  create: (
    doc: AuthenticatedDocument,
    emit: (event: FrameEvent) => void,
  ) => LocalOperations,
  cancellation?: AbortSignal,
  initialListener?: (event: FrameEvent) => void,
): Promise<MountedFrame> {
  const win = frame.ownerDocument.defaultView!;
  return new Promise((resolve, reject) => {
    const listeners = new Set<(event: FrameEvent) => void>(
      initialListener ? [initialListener] : [],
    );
    const controller = new AbortController();
    const signal = controller.signal;
    let initialSubscription = initialListener;
    let activationController: AbortController | undefined;
    let activationDocument: AuthenticatedDocument | undefined;
    let operationsDocument: AuthenticatedDocument | undefined;
    let documentWatch: number | undefined;
    let mountAuthentication: MountAuthentication | undefined;
    let operations: LocalOperations | undefined;
    let disposed = false;
    let release = () => {};
    const emit = (event: FrameEvent) => {
      for (const listener of [...listeners]) listener(event);
    };
    const disposeActivation = () => {
      activationController?.abort();
      activationController = undefined;
      activationDocument = undefined;
    };
    const adoptActivationDocument = (doc: AuthenticatedDocument) => {
      if (activationDocument === doc) return;
      disposeActivation();
      activationDocument = doc;
      activationController = new AbortController();
      listenForFrameActivations(
        doc,
        activationController.signal,
        () => listeners.size > 0,
        emit,
      );
    };
    const disposeOperations = () => {
      operations?.dispose();
      operations = undefined;
      operationsDocument = undefined;
    };
    const stopDocumentWatch = () => {
      if (documentWatch === undefined) return;
      win.clearInterval(documentWatch);
      documentWatch = undefined;
    };
    const inspectReplacementDocument = () => {
      try {
        const doc = localFrameAccess(frame).document();
        const authenticated = mountAuthentication?.authenticateAssignedDocument(
          doc,
          url,
        );
        if (authenticated && authenticated !== activationDocument) {
          disposeOperations();
          adoptActivationDocument(authenticated);
        }
      } catch {
        /* The load handler owns final origin failure reporting. */
      }
    };
    const watchReplacementDocument = () => {
      if (documentWatch !== undefined) return;
      inspectReplacementDocument();
      documentWatch = win.setInterval(inspectReplacementDocument, 0);
    };
    const disposeDocument = () => {
      stopDocumentWatch();
      disposeActivation();
      disposeOperations();
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      controller.abort();
      cancellation?.removeEventListener("abort", dispose);
      disposeDocument();
      win.clearTimeout(timer);
      listeners.clear();
      initialSubscription = undefined;
      release();
      reject(new FrameError("disposed"));
    };
    const run = async <T>(operation: () => T): Promise<T> => {
      if (disposed) throw new FrameError("disposed");
      try {
        const result = operation();
        await Promise.resolve();
        if (disposed) throw new FrameError("disposed");
        return result;
      } catch (error) {
        throw error instanceof FrameError
          ? error
          : new FrameError(
              error === "limit" ||
                error === "missing-instance" ||
                error === "unavailable"
                ? error
                : "invalid-boundary",
            );
      }
    };
    const timer = win.setTimeout(() => {
      reject(new FrameError("timeout"));
      dispose();
    }, 5000);
    const adoptLoadedDocument = () => {
      const doc = localFrameAccess(frame).document();
      if (!doc || doc.defaultView?.frameElement !== frame) {
        reject(new FrameError("origin"));
        dispose();
        return;
      }
      const authenticated = mountAuthentication?.authenticateAssignedDocument(
        doc,
        url,
      );
      if (!authenticated) {
        if (assignedFrameResource(frame, url)) return;
        reject(new FrameError("origin"));
        dispose();
        return;
      }
      if (operationsDocument === authenticated) return;
      if (new URL(authenticated.URL).hash !== url.hash) {
        try {
          authenticated.defaultView.location.replace(url.href);
        } catch {
          reject(new FrameError("origin"));
          dispose();
          return;
        }
      }
      stopDocumentWatch();
      disposeOperations();
      disposeActivation();
      win.clearTimeout(timer);
      operations = create(authenticated, emit);
      operationsDocument = authenticated;
      operations.subscribe(listeners.size > 0);
      resolve({
        updateUsage: (usage) => run(() => operations!.updateUsage(usage)),
        listInstanceBoundaries: () => run(() => operations!.list()),
        highlight: (keys, mode) => run(() => operations!.highlight(keys, mode)),
        scrollTo: (key) => run(() => operations!.scroll(key)),
        subscribe(listener) {
          if (disposed) throw new FrameError("disposed");
          if (initialSubscription === listener) {
            initialSubscription = undefined;
            return () => {
              listeners.delete(listener);
              operations?.subscribe(listeners.size > 0);
            };
          }
          const subscription = (event: FrameEvent) => listener(event);
          listeners.add(subscription);
          operations?.subscribe(true);
          return () => {
            listeners.delete(subscription);
            operations?.subscribe(listeners.size > 0);
          };
        },
        dispose,
      });
    };
    frame.addEventListener("load", adoptLoadedDocument, { signal });
    cancellation?.addEventListener("abort", dispose, { once: true });
    if (cancellation?.aborted) {
      dispose();
      return;
    }
    frame.setAttribute("sandbox", "allow-same-origin");
    release = ownFrame(frame, dispose);
    win.addEventListener("pagehide", dispose, { signal });
    try {
      const current = localFrameAccess(frame).document();
      mountAuthentication = createMountAuthentication(frame, current, url);
      if (mountAuthentication.transferredDocument)
        adoptActivationDocument(mountAuthentication.transferredDocument);
      watchReplacementDocument();
      const action = initialFrameLoad(frame, current, url, mountAuthentication);
      if (action === "adopt") adoptLoadedDocument();
      else if (action === "replace") localFrameAccess(frame).replace(url);
    } catch {
      reject(new FrameError("origin"));
      dispose();
    }
  });
}
