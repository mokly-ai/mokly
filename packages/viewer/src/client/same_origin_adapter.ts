import { currentDocumentRoute } from "../catalogue/delivery_paths.js";
import type { CatalogueUsage } from "../catalogue/types.js";
import type { ComponentViewRecord } from "../components/view_types.js";
import { inspection } from "../inspector/inspection.js";

import type { FrameAdapter } from "./frame_adapter.js";
import { FrameError } from "./frame_error.js";
import { frameUrl, temporaryFrameUrl } from "./frame_mount.js";
import { frameSession } from "./frame_session.js";
import { frameEvents, frameUsage } from "./frame_usage.js";
import { localFrameAccess } from "./same_origin_access.js";
import { installLocalHighlight } from "./same_origin_highlight.js";
import { mountLocalDocument } from "./same_origin_mount.js";

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
      const pathname = decodeURIComponent(url.pathname);
      const inspectionPath = currentDocumentRoute(pathname) ?? pathname;
      let usage = frameUsage(view.usage);
      view.signal?.throwIfAborted();
      const mounting = mountLocalDocument(
        frame,
        url,
        (doc, emit) => {
          let reader = inspection(doc, usage);
          let stop = () => {};
          let selecting = false;
          let record = localRecord(frame, view.usage);
          return {
            list: () => reader.__list(),
            scroll: (key) => reader.__scroll(key),
            inspectable: () => frameEvents(usage).includes("hover"),
            updateUsage(next) {
              const metadata = frameUsage(next);
              stop();
              stop = () => {};
              selecting = false;
              usage = metadata;
              reader = inspection(doc, usage);
              record = localRecord(frame, next);
            },
            selecting: () => selecting,
            highlight(keys, mode) {
              if (mode !== "off") reader.__keys(keys);
              stop();
              stop = () => {};
              selecting = mode !== "off";
              if (mode === "off" || !record) return;
              stop = installLocalHighlight(
                frame.ownerDocument.body,
                [
                  {
                    frame,
                    path: inspectionPath,
                    usage: record,
                  },
                ],
                (key) =>
                  emit({
                    type: "click",
                    key,
                    boxes: reader
                      .__list()
                      .find((item) => item.key === key)!
                      .ranges.flatMap((range) => range.boxes),
                  }),
                () => {
                  selecting = false;
                  stop();
                  emit({ type: "pick-end", reason: "escape" });
                },
                new Set(keys),
              );
            },
            dispose: () => stop(),
          };
        },
        view.signal,
        view.onEvent,
      );
      return mounting;
    },
  };
}

function localRecord(
  frame: HTMLIFrameElement,
  usage: CatalogueUsage,
): ComponentViewRecord | undefined {
  return usage.status === "ready"
    ? {
        ...usage,
        viewport: frameSession(frame)?.identity.viewport ?? "desktop",
        colorScheme: "light",
        styles: [],
        resources: [],
      }
    : undefined;
}
