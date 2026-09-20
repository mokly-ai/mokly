import type { CatalogueUsage } from "../catalogue/types.js";
import { logicalMarker, parseLogicalMarker } from "../navigation/logical.js";
import { parseBrowsingTarget } from "../navigation/target.js";

import type {
  FrameEvent,
  InstanceBoundary,
  MountedFrame,
} from "./frame_adapter.js";
import { FrameError } from "./frame_error.js";
import { ownFrame } from "./frame_mount.js";
import { localFrameAccess } from "./same_origin_access.js";
import { localPointer } from "./same_origin_pointer.js";

/** Input facts for one marked frame-link activation. */
export interface FrameActivationCandidate {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  download: boolean;
  eventType: "auxclick" | "click";
  marker: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: string | null;
}

/** Parent-owned action derived from a trusted marked link. */
export type FrameActivation =
  | { href: string; kind: "navigate" }
  | { href: string; kind: "open"; target: string };

/** Classify an activation without trusting a portable href. */
export function classifyFrameActivation(
  candidate: FrameActivationCandidate,
): FrameActivation | undefined {
  const destination = parseLogicalMarker(candidate.marker);
  if (!destination || logicalMarker(destination) !== candidate.marker)
    return undefined;
  if (candidate.download || candidate.altKey) return undefined;
  if (candidate.eventType === "click" && candidate.button !== 0)
    return undefined;
  if (candidate.eventType === "auxclick" && candidate.button !== 1)
    return undefined;
  const target = parseBrowsingTarget(candidate.target);
  if (target.kind === "invalid") return undefined;
  const href = `/id/${encodeURIComponent(destination.id)}${
    destination.fragment
      ? `?fragment=${encodeURIComponent(destination.fragment)}`
      : ""
  }`;
  if (target.kind === "top" || target.kind === "parent")
    return { href, kind: "navigate" };
  if (target.kind === "blank") return { href, kind: "open", target: "_blank" };
  if (target.kind === "named")
    return { href, kind: "open", target: target.name };
  const modified = candidate.metaKey || candidate.ctrlKey || candidate.shiftKey;
  return modified || candidate.eventType === "auxclick"
    ? { href, kind: "open", target: "_blank" }
    : { href, kind: "navigate" };
}

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
    let documentController: AbortController | undefined;
    let operations: LocalOperations | undefined;
    let disposed = false;
    let release = () => {};
    let pending = 0;
    const cleanups: (() => void)[] = [];
    const emit = (event: FrameEvent) => {
      for (const listener of [...listeners]) listener(event);
    };
    const activate = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(
        "[data-mokly-link]",
      );
      if (!link || !listeners.size || !["a", "area"].includes(link.localName))
        return;
      const marker = link.getAttribute("data-mokly-link") ?? "";
      const target = parseBrowsingTarget(
        link.getAttribute("data-mokly-target"),
      );
      const destination = parseLogicalMarker(marker);
      if (
        !destination ||
        target.kind === "invalid" ||
        !classifyFrameActivation({
          altKey: event.altKey,
          button: event.button,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          download: link.hasAttribute("download"),
          eventType: event.type === "click" ? "click" : "auxclick",
          marker,
          target: link.getAttribute("data-mokly-target"),
        })
      )
        return;
      event.preventDefault();
      emit({
        type: "navigation",
        navigation: {
          ...destination,
          target,
          activation:
            event.type === "auxclick"
              ? "middle"
              : event.metaKey || event.ctrlKey || event.shiftKey
                ? "modified"
                : "primary",
        },
      });
    };
    const listenForActivations = (
      doc: Document,
      documentSignal: AbortSignal,
    ) => {
      doc.addEventListener("click", activate, { signal: documentSignal });
      doc.addEventListener("auxclick", activate, { signal: documentSignal });
    };
    const disposeDocument = () => {
      documentController?.abort();
      documentController = undefined;
      operations?.dispose();
      operations = undefined;
      for (const cleanup of cleanups.splice(0)) cleanup();
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
    frame.addEventListener(
      "load",
      () => {
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
        if (new URL(doc.URL).hash !== url.hash) {
          try {
            doc.defaultView.location.replace(url.href);
          } catch {
            reject(new FrameError("origin"));
            dispose();
            return;
          }
        }
        disposeDocument();
        win.clearTimeout(timer);
        documentController = new AbortController();
        const documentSignal = documentController.signal;
        operations = create(doc, emit);
        listenForActivations(doc, documentSignal);
        const inspecting = () =>
          listeners.size > 0 && operations!.inspectable();
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
          highlight: (keys, mode) =>
            run(() => operations!.highlight(keys, mode)),
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
      },
      { signal },
    );
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
        documentController = new AbortController();
        listenForActivations(current, documentController.signal);
      }
      localFrameAccess(frame).replace(url);
    } catch {
      reject(new FrameError("origin"));
      dispose();
    }
  });
}

function sameFrameResource(documentUrl: string, expected: URL): boolean {
  const actual = new URL(documentUrl);
  return (
    actual.origin === expected.origin &&
    !actual.username &&
    !actual.password &&
    normalizedHtmlPath(actual.pathname) ===
      normalizedHtmlPath(expected.pathname) &&
    actual.search === expected.search
  );
}

function assignedFrameResource(
  frame: HTMLIFrameElement,
  expected: URL,
): boolean {
  const source = frame.getAttribute("src");
  if (!source) return false;
  try {
    return sameFrameResource(
      new URL(source, frame.ownerDocument.baseURI).href,
      expected,
    );
  } catch {
    return false;
  }
}

function normalizedHtmlPath(pathname: string): string {
  return pathname.endsWith(".html") ? pathname.slice(0, -5) : pathname;
}
