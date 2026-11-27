import { encodeAccessMessage, type AccessToken } from "../access/channel.js";
import type {
  FrameAdapter,
  FrameEvent,
  MountedFrame,
} from "../frame_adapter.js";
import { origin } from "../probe/values.js";

import { frameHandshake } from "./access_phase.js";
import { accessRenewal } from "./access_renewal.js";
import { FrameError } from "./frame_error.js";
import { notifyFrameListeners } from "./frame_event_listeners.js";
import { frameUrl, ownFrame } from "./frame_mount.js";
import {
  frameEvents,
  frameUsage,
  knownKey,
  validateBoundaryUsage,
} from "./frame_usage.js";
import { messageTransport } from "./message_transport.js";
import { forwardPostMessageEvent } from "./post_message_events.js";

/** Explicit opt-in for a separately hosted, nonopaque consumer document. */
export function postMessageAdapter(options: {
  frameOrigin: string;
  access?: () => Promise<AccessToken>;
  onAccessFailure?: () => void;
}): FrameAdapter {
  const frameOrigin = options.frameOrigin;
  if (!origin(frameOrigin)) throw new FrameError("origin");
  const renewal = options.access && accessRenewal(options.access);
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
      const { canvasInput } = view;
      let allowedEvents = frameEvents(usage, canvasInput);
      url.searchParams.set("mokly-host", win.location.origin);
      const bytes = win.crypto.getRandomValues(new Uint8Array(16));
      const nonce = [...bytes]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const listeners = new Set<(event: FrameEvent) => void>(
        view.onEvent ? [view.onEvent] : [],
      );
      let initialSubscription = view.onEvent;
      let ready = false,
        disposed = false;
      let release = () => {};
      let resolveReady: (mounted: MountedFrame) => void;
      let rejectReady: (error: FrameError) => void;
      const completion = new Promise<MountedFrame>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });
      const notify = (event: FrameEvent) =>
        notifyFrameListeners(win, listeners, event);
      const dispose = (
        code: "disposed" | "timeout" | "unavailable" = "disposed",
      ) => {
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
        handshake.dispose();
        win.removeEventListener("message", receive);
        win.removeEventListener("pagehide", unload);
        frame.removeEventListener("load", handshake.load);
        transport.dispose(code);
        releaseRenewal?.();
        release();
        if (!ready) rejectReady(new FrameError(code));
        if (code === "timeout") notify({ type: "error", code });
        listeners.clear();
        initialSubscription = undefined;
      };
      const post = (json: string) => {
        if (!frame.contentWindow) throw new FrameError("unavailable");
        frame.contentWindow.postMessage(json, frameOrigin);
      };
      const transport = messageTransport(win, nonce, post, () =>
        dispose("timeout"),
      );
      const handshake = frameHandshake(
        win,
        () => transport.send({ type: "hello" }),
        dispose,
        renewal && {
          request: renewal.request,
          send(token) {
            post(encodeAccessMessage({ type: "token", ...token }));
            renewal.remember(token);
          },
          onFailure: options.onAccessFailure,
        },
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
          events: listeners.size ? allowedEvents : [],
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
          allowedEvents = frameEvents(usage, canvasInput);
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
        async boxModel(key) {
          check([key]);
          const response = await transport.request({ type: "measure", key });
          check([key]);
          if (response.type !== "box-model")
            throw new FrameError("invalid-message");
          return response.boxModel;
        },
        async contentBox() {
          if (disposed) throw new FrameError("disposed");
          const response = await transport.request({ type: "measure-content" });
          if (disposed) throw new FrameError("disposed");
          if (response.type !== "content-box")
            throw new FrameError("invalid-message");
          return response.contentBox;
        },
        subscribe(listener) {
          if (disposed) throw new FrameError("disposed");
          if (initialSubscription === listener) {
            initialSubscription = undefined;
            return () => {
              if (listeners.delete(listener) && !listeners.size && !disposed)
                subscribed();
            };
          }
          const subscription = (event: FrameEvent) => listener(event);
          const first = !listeners.size;
          listeners.add(subscription);
          if (first) subscribed();
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
        if (handshake.receive(event.data)) return;
        const message = transport.receive(event.data);
        if (!message) return;
        if (!ready) {
          if (message.type === "ready" && handshake.ready()) {
            ready = true;
            if (listeners.size) subscribed();
            resolveReady(mounted);
          }
          return;
        }
        if (message.type === "error" && message.requestId === null)
          notify({ type: "error", code: message.code });
        if (
          !listeners.size ||
          !allowedEvents.some((type) => type === message.type)
        )
          return;
        forwardPostMessageEvent(message, usage, notify);
      };
      const unload = () => dispose();
      release = ownFrame(frame, unload);
      const releaseRenewal = renewal?.add(win, (message) => {
        if (ready) post(message);
      });
      view.signal?.addEventListener("abort", unload, { once: true });
      win.addEventListener("message", receive);
      win.addEventListener("pagehide", unload);
      frame.addEventListener("load", handshake.load);
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
