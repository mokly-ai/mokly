import type { FrameAdapter } from "@mokly/frame";
import { probeRuntime } from "@mokly/frame/internal";

import { FrameError } from "./frame_error.js";
import { frameUrl, temporaryFrameUrl } from "./frame_mount.js";
import { frameEvents, frameUsage } from "./frame_usage.js";
import { localFrameAccess } from "./same_origin_access.js";
import { mountLocalDocument } from "./same_origin_mount.js";
import { classifyLocalActivation } from "./same_origin_navigation.js";

export function localFramePath(frame: HTMLIFrameElement): string | undefined {
  return localFrameAccess(frame).pathname();
}

/** Script-disabled local mounts report geometry and picks without drawing. */
export function sameOriginAdapter(): FrameAdapter {
  return localAdapter(frameUrl);
}

/** Private local adapter for authenticated in-memory component previews. */
export function temporaryPreviewAdapter(): FrameAdapter {
  return localAdapter(temporaryFrameUrl);
}

function localAdapter(resolveUrl: typeof frameUrl): FrameAdapter {
  return {
    async mount(frame, view) {
      const win = frame.ownerDocument.defaultView;
      if (!win) throw new FrameError("unavailable");
      const url = resolveUrl(frame, view, win.location.origin);
      let usage = frameUsage(view.usage);
      view.signal?.throwIfAborted();
      const mounting = mountLocalDocument(
        frame,
        url,
        (doc, emit) => {
          const start = () =>
            probeRuntime(
              doc.defaultView,
              usage,
              win,
              classifyLocalActivation,
              emit,
            );
          let runtime = start();
          let subscribed = false;
          const subscribe = (enabled: boolean) => {
            subscribed = enabled;
            runtime.__subscribe(enabled ? frameEvents(usage) : []);
          };
          return {
            list: () => runtime.__list(),
            scroll: (key) => runtime.__scroll(key),
            highlight: (keys, mode) => runtime.__highlight(keys, mode),
            subscribe,
            updateUsage(next) {
              const metadata = frameUsage(next);
              runtime.__dispose();
              usage = metadata;
              runtime = start();
              subscribe(subscribed);
            },
            dispose: () => runtime.__dispose(),
          };
        },
        view.signal,
        view.onEvent,
      );
      return mounting;
    },
  };
}
