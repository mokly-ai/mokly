import { origin } from "../inspector/values.js";

import type {
  FrameAdapter,
  FrameEvent,
  MountedFrame,
} from "./frame_adapter.js";
import { FrameError } from "./frame_error.js";
import { frameUrl, ownFrame } from "./frame_mount.js";
import {
  frameEvents,
  frameUsage,
  knownKey,
  validateBoundaryUsage,
} from "./frame_usage.js";
import { messageTransport } from "./message_transport.js";

/** Explicit opt-in for a separately hosted, nonopaque consumer document. */
export function postMessageAdapter(options: {
  frameOrigin: string;
}): FrameAdapter {
  const frameOrigin = options.frameOrigin;
  if (!origin(frameOrigin)) throw new FrameError("origin");
  return {
    async mount(frame, view) {
      view.signal?.throwIfAborted();
      const win = frame.ownerDocument.defaultView;
      if (
        !win ||
        !origin(win.location.origin) ||
        frameOrigin === win.location.origin
      )
        throw new FrameError("origin");
      const url = frameUrl(frame, view, frameOrigin);
      let usage = frameUsage(view.usage);
      url.searchParams.set("mokly-host", win.location.origin);
      const bytes = win.crypto.getRandomValues(new Uint8Array(16));
      const nonce = [...bytes]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const listeners = new Set<(event: FrameEvent) => void>();
      let loaded = false,
        ready = false,
        disposed = false;
      let release = () => {};
      let resolveReady: (mounted: MountedFrame) => void;
      let rejectReady: (error: FrameError) => void;
      const completion = new Promise<MountedFrame>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });
      const notify = (event: FrameEvent) => {
        for (const listener of [...listeners]) listener(event);
      };
      const dispose = (code: "disposed" | "timeout" = "disposed") => {
        if (disposed) return;
        if (ready) {
          try {
            transport.send({ type: "dispose" });
          } catch {
            /* The document may already have unloaded. */
          }
        }
        disposed = true;
        view.signal?.removeEventListener("abort", unload);
        win.clearTimeout(timer);
        win.removeEventListener("message", receive);
        win.removeEventListener("pagehide", unload);
        frame.removeEventListener("load", load);
        transport.dispose(code);
        release();
        if (!ready) rejectReady(new FrameError(code));
        if (code === "timeout") notify({ type: "error", code });
        listeners.clear();
      };
      const transport = messageTransport(
        win,
        nonce,
        (json) => {
          if (!frame.contentWindow) throw new FrameError("unavailable");
          frame.contentWindow.postMessage(json, frameOrigin);
        },
        () => dispose("timeout"),
      );
      const check = (keys: readonly string[]) => {
        if (disposed) throw new FrameError("disposed");
        if (usage.error) throw new FrameError(usage.error);
        if (keys.some((key) => !knownKey(usage, key)))
          throw new FrameError("missing-instance");
      };
      const subscribeEvents = () =>
        transport.request({
          type: "subscribe",
          events: listeners.size ? frameEvents(usage) : [],
        });
      const subscribed = () => {
        void subscribeEvents().catch((error: unknown) => {
          if (!disposed)
            notify({
              type: "error",
              code: error instanceof FrameError ? error.code : "unavailable",
            });
        });
      };
      const mounted: MountedFrame = {
        async updateUsage(next) {
          if (disposed) throw new FrameError("disposed");
          usage = frameUsage(next);
          await Promise.all([mounted.highlight([], "off"), subscribeEvents()]);
          if (disposed) throw new FrameError("disposed");
        },
        async listInstanceBoundaries() {
          check([]);
          const response = await transport.request({ type: "list" });
          check([]);
          if (
            response.type !== "boundaries" ||
            !validateBoundaryUsage(response.boundaries, usage)
          )
            throw new FrameError("invalid-message");
          return response.boundaries;
        },
        async highlight(keys, mode) {
          if (mode !== "off") check(keys);
          await transport.request({ type: "highlight", keys, mode });
          if (disposed) throw new FrameError("disposed");
        },
        async scrollTo(key) {
          check([key]);
          await transport.request({ type: "scroll-to", key });
          check([key]);
        },
        subscribe(listener) {
          if (disposed) throw new FrameError("disposed");
          const subscription = (event: FrameEvent) => listener(event);
          listeners.add(subscription);
          if (listeners.size === 1) subscribed();
          return () => {
            if (listeners.delete(subscription) && !listeners.size && !disposed)
              subscribed();
          };
        },
        dispose: () => dispose(),
      };
      const receive = (event: MessageEvent<unknown>) => {
        if (
          disposed ||
          event.source !== frame.contentWindow ||
          event.origin !== frameOrigin ||
          event.ports.length
        )
          return;
        const message = transport.receive(event.data);
        if (!message) return;
        if (!ready) {
          if (loaded && message.type === "ready") {
            ready = true;
            win.clearTimeout(timer);
            resolveReady(mounted);
          }
          return;
        }
        if (message.type === "error" && message.requestId === null)
          notify({ type: "error", code: message.code });
        const events: readonly string[] = frameEvents(usage);
        if (!listeners.size || !events.includes(message.type)) return;
        if (message.type === "hover" || message.type === "click") {
          if (message.key !== null && !knownKey(usage, message.key)) {
            notify({ type: "error", code: "invalid-message" });
            return;
          }
          notify(
            message.type === "click"
              ? { type: "click", key: message.key, boxes: message.boxes }
              : { type: "hover", key: message.key, boxes: message.boxes },
          );
        } else if (message.type === "geometry") notify({ type: "geometry" });
        else if (message.type === "pick-end")
          notify({ type: "pick-end", reason: message.reason });
        else if (message.type === "navigation")
          notify({ type: "navigation", navigation: message.navigation });
      };
      const load = () => {
        if (loaded) {
          dispose();
          return;
        }
        loaded = true;
        try {
          transport.send({ type: "hello" });
        } catch {
          dispose();
        }
      };
      const unload = () => dispose();
      const timer = win.setTimeout(() => dispose("timeout"), 5000);
      release = ownFrame(frame, unload);
      view.signal?.addEventListener("abort", unload, { once: true });
      win.addEventListener("message", receive);
      win.addEventListener("pagehide", unload);
      frame.addEventListener("load", load);
      frame.setAttribute("sandbox", "allow-same-origin allow-scripts");
      try {
        if (!frame.contentWindow) throw new FrameError("unavailable");
        frame.contentWindow.location.replace(url.href);
      } catch {
        dispose();
      }
      return completion;
    },
  };
}
