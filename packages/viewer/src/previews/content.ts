/** Resolve historical documents only inside the accepted preview generation. */
import type { EntryDetailV4 } from "../catalogue/types.js";
import { encodeUrlPath } from "../data/paths.js";
import {
  snapshotDocumentPath,
  snapshotViewPath,
} from "../navigation/routes.js";
import { parseRemovedPagePreview } from "../review/page_preview.js";
import type { RemovedPreviewData } from "../shell/previews.js";

import type { PreviewContent } from "./request.js";

function unavailable(): never {
  throw new Error("The previous version is unavailable.");
}

/** One parsed page or document preview and the base commit its metadata names. */
export interface ParsedPagePreview {
  baseCommit: string;
  content: PreviewContent;
}

/**
 * A removed screen's views from the route's held detail. The route's fences
 * accepted that detail for this record, so it is not checked again.
 */
export function screenContent(
  data: RemovedPreviewData,
  detail: EntryDetailV4 | undefined,
  base: string,
): PreviewContent {
  if (!detail) unavailable();
  const views = detail.views.flatMap((view) =>
    view.state === "removed"
      ? [
          {
            colorScheme: view.colorScheme,
            url: new URL(
              encodeUrlPath(
                snapshotViewPath(
                  "before",
                  data.path,
                  view.viewport,
                  view.colorScheme,
                ),
              ),
              base,
            ).href,
            viewport: view.viewport,
          },
        ]
      : [],
  );
  if (!views.length) unavailable();
  return { kind: "screen", views };
}

/** A removed page's or document's documents from its preview metadata. */
export function pageContent(
  data: RemovedPreviewData,
  payload: unknown,
  base: string,
): ParsedPagePreview {
  const preview = parseRemovedPagePreview(payload);
  if (preview.path !== data.path) unavailable();
  if (data.kind === "document") {
    if (!data.colorSchemes?.includes("light")) unavailable();
    return {
      baseCommit: preview.baseCommit,
      content: {
        kind: "document",
        views: data.colorSchemes.map((colorScheme) => ({
          colorScheme,
          url: new URL(
            encodeUrlPath(
              snapshotDocumentPath("before", data.path, colorScheme),
            ),
            base,
          ).href,
        })),
      },
    };
  }
  return {
    baseCommit: preview.baseCommit,
    content: {
      kind: "page",
      url: new URL(
        encodeUrlPath(snapshotDocumentPath("before", data.path, "light")),
        base,
      ).href,
    },
  };
}
