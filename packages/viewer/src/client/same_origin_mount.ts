import type { CatalogueUsage } from "../catalogue/types.js";

import type {
  FrameEvent,
  InstanceBoundary,
  MountedFrame,
} from "./frame_adapter.js";
import { FrameError } from "./frame_error.js";
import { ownFrame } from "./frame_mount.js";
import {
  assignedFrameResource,
  localFrameAccess,
  recordedFrameResource,
  sameFrameResource,
} from "./same_origin_access.js";
import { listenForFrameActivations } from "./same_origin_navigation.js";
import { localPointer } from "./same_origin_pointer.js";

interface LocalOperations {
  updateUsage(usage: CatalogueUsage): void;
  inspectable(): boolean;
  list(): readonly InstanceBoundary[];
  highlight(keys: readonly string[], mode: "off" | "highlight" | "pick"): void;
  scroll(key: string): void;
  selecting(): boolean;
  dispose(): void;
}

/** Load/session ownership, with no inspector handshake or consumer script permission. */
export function mountLocalDocument(
  frame: HTMLIFrameElement,
  url: URL,
  create: (doc: Document, emit: (event: FrameEvent) => void) => LocalOperations,
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
    let activationDocument: Document | undefined;
    let operationsController: AbortController | undefined;
    let operationsDocument: Document | undefined;
    let documentWatch: number | undefined;
    let operations: LocalOperations | undefined;
    let disposed = false;
    let release = () => {};
    let pending = 0;
    const cleanups: (() => void)[] = [];
    const emit = (event: FrameEvent) => {
      for (const listener of [...listeners]) listener(event);
    };
    const disposeActivation = () => {
      activationController?.abort();
      activationController = undefined;
      activationDocument = undefined;
    };
    const adoptActivationDocument = (doc: Document) => {
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
      operationsController?.abort();
      operationsController = undefined;
      operations?.dispose();
      operations = undefined;
      operationsDocument = undefined;
      for (const cleanup of cleanups.splice(0)) cleanup();
    };
    const stopDocumentWatch = () => {
      if (documentWatch === undefined) return;
      win.clearInterval(documentWatch);
      documentWatch = undefined;
    };
    const inspectReplacementDocument = () => {
      try {
        const doc = localFrameAccess(frame).document();
        if (
          doc &&
          doc !== activationDocument &&
          doc.defaultView?.frameElement === frame &&
          sameFrameResource(doc.URL, url)
        ) {
          disposeOperations();
          adoptActivationDocument(doc);
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
      if (pending) win.cancelAnimationFrame(pending);
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
      if (!sameFrameResource(doc.URL, url)) {
        if (assignedFrameResource(frame, url)) return;
        reject(new FrameError("origin"));
        dispose();
        return;
      }
      if (operationsDocument === doc) return;
      if (new URL(doc.URL).hash !== url.hash) {
        try {
          doc.defaultView.location.replace(url.href);
        } catch {
          reject(new FrameError("origin"));
          dispose();
          return;
        }
      }
      stopDocumentWatch();
      disposeOperations();
      adoptActivationDocument(doc);
      win.clearTimeout(timer);
      operationsController = new AbortController();
      const documentSignal = operationsController.signal;
      operations = create(doc, emit);
      operationsDocument = doc;
      const inspecting = () => listeners.size > 0 && operations!.inspectable();
      localPointer(
        doc,
        () => operations!.list(),
        emit,
        inspecting,
        () => operations!.selecting(),
        documentSignal,
      );
      const changed = () => {
        if (inspecting() && !pending)
          pending = win.requestAnimationFrame(() => {
            pending = 0;
            if (inspecting()) emit({ type: "geometry" });
          });
      };
      doc.addEventListener("scroll", changed, {
        capture: true,
        passive: true,
        signal: documentSignal,
      });
      doc.addEventListener("load", changed, {
        capture: true,
        signal: documentSignal,
      });
      doc.fonts.addEventListener("loadingdone", changed, {
        signal: documentSignal,
      });
      win.addEventListener("resize", changed, { signal: documentSignal });
      const resize = new ResizeObserver(changed),
        mutations = new MutationObserver(changed);
      resize.observe(frame);
      if (doc.body) resize.observe(doc.body);
      mutations.observe(doc, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
      });
      cleanups.push(() => {
        resize.disconnect();
        mutations.disconnect();
      });
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
            };
          }
          const subscription = (event: FrameEvent) => listener(event);
          listeners.add(subscription);
          return () => {
            listeners.delete(subscription);
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
      if (current?.defaultView?.frameElement === frame) {
        adoptActivationDocument(current);
      }
      watchReplacementDocument();
      if (assignedFrameResource(frame, url)) {
        if (
          current?.defaultView?.frameElement === frame &&
          current.readyState === "complete" &&
          sameFrameResource(current.URL, url)
        ) {
          adoptLoadedDocument();
        } else if (
          current?.defaultView?.frameElement === frame &&
          current.readyState === "complete" &&
          current.URL !== "about:blank" &&
          !recordedFrameResource(frame, current.URL)
        ) {
          localFrameAccess(frame).replace(url);
        }
      } else {
        localFrameAccess(frame).replace(url);
      }
    } catch {
      reject(new FrameError("origin"));
      dispose();
    }
  });
}
