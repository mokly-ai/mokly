import {
  currentDocumentRoute,
  type GeneratedPathPrefix,
} from "../catalogue/delivery_paths.js";
import type { CatalogueUsage } from "../catalogue/types.js";
import type { ComponentViewRecord } from "../components/manifest_types.js";
import { inspection } from "../inspector/inspection.js";

import { authenticateRanges, rangeBounds } from "./component_geometry.js";
import type { FrameAdapter } from "./frame_adapter.js";
import { FrameError } from "./frame_error.js";
import { frameUrl, temporaryFrameUrl } from "./frame_mount.js";
import { frameEvents, frameUsage } from "./frame_usage.js";
import { localFrameAccess } from "./same_origin_access.js";
import {
  installLocalHighlight,
  type HighlightFrame,
} from "./same_origin_highlight.js";
import { mountLocalDocument } from "./same_origin_mount.js";

/** Current-document capability used by the synchronous, SSR-enhanced local shell. */
export function localInspection(
  frame: HTMLIFrameElement,
  path: string,
  usage: ComponentViewRecord,
) {
  const authenticated = authenticateRanges(frame, path, usage);
  if (!authenticated) return;
  return {
    measure: (keys: ReadonlySet<string>) =>
      rangeBounds(frame, authenticated, keys),
    reveal: (key: string) => {
      const range = authenticated.ranges.get(key)?.[0];
      const node = range?.startContainer.childNodes[range.startOffset];
      const target =
        node?.nodeType === 1 ? (node as Element) : node?.parentElement;
      target?.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
  };
}
export function localPresentation(
  root: HTMLElement,
  frames: readonly HighlightFrame[],
  selected: string | undefined,
  label: (key: string) => string,
  select: (key: string, viewport: "mobile" | "desktop") => void,
  exit: () => void,
): () => void {
  return installLocalHighlight(root, frames, selected, label, select, exit);
}
export function replaceLocalFrame(frame: HTMLIFrameElement, url: URL): void {
  localFrameAccess(frame).replace(url);
}
export function localFramePath(frame: HTMLIFrameElement): string | undefined {
  return localFrameAccess(frame).pathname();
}
export function localFrameReady(
  frame: HTMLIFrameElement,
  path: string,
  prefix?: GeneratedPathPrefix,
): boolean {
  const pathname = localFramePath(frame);
  return (
    localFrameAccess(frame).document()?.readyState === "complete" &&
    pathname !== undefined &&
    currentDocumentRoute(pathname, prefix) === path
  );
}

/** Script-disabled local mounts retain the parent-owned highlight presentation. */
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
      const inspectionPath =
        currentDocumentRoute(pathname, view.generatedPathPrefix) ?? pathname;
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
                frame.closest<HTMLElement>(".mokly-viewer") ??
                  frame.ownerDocument.body,
                [
                  {
                    frame,
                    path: inspectionPath,
                    usage: record,
                  },
                ],
                undefined,
                undefined,
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
        viewport:
          frame.dataset["workspaceFrame"] === "mobile" ? "mobile" : "desktop",
        colorScheme: "light",
        styles: [],
        resources: [],
      }
    : undefined;
}
