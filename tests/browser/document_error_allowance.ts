import type { ErrorAllowance } from "./error_monitor.js";

/** Native documents have no root favicon; the published inspector needs HTTP. */
export function documentFavicon(
  allow: (rule: ErrorAllowance) => void,
  origin: string,
): void {
  if (process.env["MOKLY_PLAYWRIGHT_FILE_DIR"])
    allow({
      kind: "console",
      message: /^Failed to load resource: net::ERR_FILE_NOT_FOUND$/u,
      url: /^file:\/\/\/mokly-viewer\/client\/inspector\.js$/u,
    });
  const url = new URL("/favicon.ico", origin).href.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  allow({
    kind: "console",
    message:
      /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/u,
    url: new RegExp(`^${url}$`, "u"),
  });
}

/** One deliberately missing HTTP resource, scoped to its exact URL. */
export function missingResourceNotice(url: string): ErrorAllowance {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    kind: "console",
    message:
      /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/u,
    url: new RegExp(`^${escaped}$`, "u"),
  };
}

/** An intentional service-unavailable response from a named test resource. */
export function unavailableResourceNotice(url: string): ErrorAllowance {
  const rule = missingResourceNotice(url);
  return {
    ...rule,
    message:
      /^Failed to load resource: the server responded with a status of 503 \(Service Unavailable\)$/u,
  };
}
