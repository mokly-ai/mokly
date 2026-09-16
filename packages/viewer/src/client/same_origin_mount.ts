import type { CatalogueUsage } from "../catalogue/types.js";
import { parseLogicalMarker } from "../navigation/logical.js";
import { parseBrowsingTarget } from "../navigation/target.js";

import type {
  FrameEvent,
  InstanceBoundary,
  MountedFrame,
} from "./frame_adapter.js";
import { FrameError } from "./frame_error.js";
import { ownFrame } from "./frame_mount.js";
import { classifyFrameActivation } from "./frame_navigation.js";
import { localFrameAccess } from "./same_origin_access.js";
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
): Promise<MountedFrame> {
  const win = frame.ownerDocument.defaultView!;
  return new Promise((resolve, reject) => {
    const listeners = new Set<(event: FrameEvent) => void>();
    const controller = new AbortController();
    const signal = controller.signal;
    let operations: LocalOperations | undefined;
    let disposed = false;
    let release = () => {};
    let pending = 0;
    const cleanups: (() => void)[] = [];
    const emit = (event: FrameEvent) => {
      for (const listener of [...listeners]) listener(event);
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      controller.abort();
      cancellation?.removeEventListener("abort", dispose);
      operations?.dispose();
      for (const cleanup of cleanups) cleanup();
      win.clearTimeout(timer);
      if (pending) win.cancelAnimationFrame(pending);
      listeners.clear();
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
        if (operations) {
          dispose();
          return;
        }
        const doc = localFrameAccess(frame).document();
        if (
          !doc ||
          doc.defaultView?.frameElement !== frame ||
          doc.URL !== url.href
        ) {
          reject(new FrameError("origin"));
          dispose();
          return;
        }
        win.clearTimeout(timer);
        operations = create(doc, emit);
        const inspecting = () =>
          listeners.size > 0 && operations!.inspectable();
        localPointer(
          doc,
          () => operations!.list(),
          emit,
          inspecting,
          () => operations!.selecting(),
          signal,
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
          signal,
        });
        doc.addEventListener("load", changed, { capture: true, signal });
        doc.fonts.addEventListener("loadingdone", changed, { signal });
        win.addEventListener("resize", changed, { signal });
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
        const activate = (event: MouseEvent) => {
          const link = (event.target as Element | null)?.closest?.(
            "[data-mokly-link]",
          );
          if (
            !link ||
            !listeners.size ||
            !["a", "area"].includes(link.localName)
          )
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
              ...event,
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
        doc.addEventListener("click", activate, { signal });
        doc.addEventListener("auxclick", activate, { signal });
        resolve({
          updateUsage: (usage) => run(() => operations!.updateUsage(usage)),
          listInstanceBoundaries: () => run(() => operations!.list()),
          highlight: (keys, mode) =>
            run(() => operations!.highlight(keys, mode)),
          scrollTo: (key) => run(() => operations!.scroll(key)),
          subscribe(listener) {
            if (disposed) throw new FrameError("disposed");
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
      localFrameAccess(frame).replace(url);
    } catch {
      reject(new FrameError("origin"));
      dispose();
    }
  });
}
