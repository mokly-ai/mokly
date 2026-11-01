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

/** One parsed preview and the identity its metadata proves. */
export interface ParsedPreview {
  identity:
    | { kind: "snapshot"; snapshotId: string }
    | { kind: "base"; baseCommit: string };
  content: PreviewContent;
}

/** A removed screen's views from the route's accepted detail. */
export function screenContent(
  data: RemovedPreviewData,
  detail: EntryDetailV4 | undefined,
  base: string,
): ParsedPreview {
  if (
    !detail ||
    detail.entry.kind !== "screen" ||
    detail.entry.path !== data.path ||
    detail.entry.snapshotId === undefined
  )
    unavailable();
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
  return {
    identity: { kind: "snapshot", snapshotId: detail.entry.snapshotId },
    content: { kind: "screen", views },
  };
}

export function pageContent(
  data: RemovedPreviewData,
  payload: unknown,
  base: string,
): ParsedPreview {
  const preview = parseRemovedPagePreview(payload);
  if (preview.path !== data.path) unavailable();
  if (data.kind === "document") {
    if (!data.colorSchemes?.includes("light")) unavailable();
    return {
      identity: { kind: "base", baseCommit: preview.baseCommit },
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
    identity: { kind: "base", baseCommit: preview.baseCommit },
    content: {
      kind: "page",
      url: new URL(
        encodeUrlPath(snapshotDocumentPath("before", data.path, "light")),
        base,
      ).href,
    },
  };
}
