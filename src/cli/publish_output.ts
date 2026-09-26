import type { PublishResult } from "../publish/types.js";

/** Plain/rich summary copy and a credential-safe optional viewer destination. */
export interface PublishOutput {
  plain: string;
  rich: string;
  viewerUrl: string | null;
}

/** Build the documented publication output without exposing bearer credentials. */
export function publishOutput(
  result: PublishResult,
  token: string | undefined,
): PublishOutput {
  const published = result.outcome === "published";
  return {
    plain: published
      ? `Published Mokly catalogue. ${result.uploaded} files uploaded, ${result.unchanged} unchanged.\n`
      : "Mokly catalogue already published for this commit.\n",
    rich: published
      ? `Published Mokly catalogue · ${result.uploaded} files uploaded, ${result.unchanged} unchanged`
      : "Mokly catalogue already published for this commit",
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
