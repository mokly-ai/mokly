/** Resolve historical documents only inside the accepted preview generation. */
import { encodeUrlPath } from "../data/paths.js";
import { reviewSnapshotViewPath } from "../navigation/review_snapshot.js";
import { snapshotDocumentPath } from "../navigation/routes.js";
import { parseRemovedPagePreview } from "../review/page_preview.js";
import { parseReviewResult } from "../review/result_validation.js";
import type { RemovedPreviewData } from "../shell/previews.js";

import type { PreviewContent } from "./request.js";

function unavailable(): never {
  throw new Error("The previous version is unavailable.");
}

interface ParsedPreview {
  baseCommit: string;
  content: PreviewContent;
}

export function screenContent(
  data: RemovedPreviewData,
  payload: unknown,
  base: string,
): ParsedPreview {
  const result = parseReviewResult(payload);
  const screen = result.screens.find(
    (candidate) => candidate.path === data.path,
  );
  if (!screen || "after" in screen) unavailable();
  const views = screen.views.flatMap((view) =>
    view.state === "removed"
      ? [
          {
            colorScheme: view.colorScheme,
            url: new URL(
              encodeUrlPath(reviewSnapshotViewPath("before", screen, view)),
              base,
            ).href,
            viewport: view.viewport,
          },
        ]
      : [],
  );
  if (!views.length) unavailable();
  return {
    baseCommit: result.baseCommit,
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
