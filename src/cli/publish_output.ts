import type { PublishResult } from "../publish/types.js";

import { formatBytes, formatCount } from "./reporter/terminal.js";

/** Unstyled result line for a publication with uncommitted changes. */
export const UNCOMMITTED_CHANGES_LINE =
  "This publication includes uncommitted changes.";

/** Plain/rich summary copy and a credential-safe optional viewer destination. */
export interface PublishOutput {
  plain: string;
  rich: string;
  /** Unstyled line written after the summary in both output modes. */
  note: string | null;
  viewerUrl: string | null;
}

/** Format one upload phase update, including the empty-round reset label. */
export function publishProgressLabel(progress: {
  completed: number;
  total: number;
  totalBytes: number;
}): string {
  return progress.total === 0
    ? "Uploading catalogue"
    : `Uploading ${progress.completed} of ${formatCount(progress.total, "file")} · ${formatBytes(progress.totalBytes)}`;
}

/** Build the documented publication output without exposing bearer credentials. */
export function publishOutput(
  result: PublishResult,
  token: string | undefined,
): PublishOutput {
  const published = result.outcome === "published";
  const uploaded = formatCount(result.uploaded, "file");
  return {
    plain: published
      ? `Published Mokly catalogue. ${uploaded} uploaded, ${result.unchanged} unchanged.\n`
      : "Mokly catalogue already published for this commit.\n",
    rich: published
      ? `Published Mokly catalogue · ${uploaded} uploaded, ${result.unchanged} unchanged`
      : "Mokly catalogue already published for this commit",
    note: result.uncommittedChanges ? UNCOMMITTED_CHANGES_LINE : null,
    viewerUrl: safeViewerUrl(result.viewerUrl, token),
  };
}

function safeViewerUrl(
  viewerUrl: string | null,
  token: string | undefined,
): string | null {
  if (!viewerUrl || !token) return viewerUrl;
  return viewerUrl.includes(token) ||
    viewerUrl.includes(encodeURIComponent(token))
    ? null
    : viewerUrl;
}
