import type { ErrorAllowance } from "./error_monitor.js";

const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "u");

const reasons = {
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
  503: "Service Unavailable",
} as const;

function notice(
  origin: string,
  pathname: string,
  message: string,
): ErrorAllowance {
  return {
    kind: "console",
    message: exact(message),
    url: exact(new URL(pathname, origin).href),
  };
}

/** A response deliberately rejected by one shell recovery test. */
export function responseFailure(
  origin: string,
  pathname: string,
  status: keyof typeof reasons,
): ErrorAllowance {
  return notice(
    origin,
    pathname,
    `Failed to load resource: the server responded with a status of ${status} (${reasons[status]})`,
  );
}

/** The sandbox reports each form submission that a read-only document blocks. */
export const blockedFormSubmission: ErrorAllowance = {
  kind: "console",
  message:
    /^Blocked form submission to 'https:\/\/example\.com\/form' because the form's frame is sandboxed and the 'allow-forms' permission is not set\.$/u,
  url: /^about:srcdoc$/u,
};

/** A named request deliberately aborted by its shell recovery test. */
export function networkFailure(
  origin: string,
  pathname: string,
): ErrorAllowance {
  return notice(origin, pathname, "Failed to load resource: net::ERR_FAILED");
}

/** The standalone shell reports each deliberately unsupported boundary version. */
export function versionFailure(
  origin: string,
  boundary: "catalogue" | "detail",
  version: number,
  supported: number,
): ErrorAllowance {
  return notice(
    origin,
    "/mokly-viewer/client/shell.js",
    "This catalogue needs a compatible viewer " +
      `Unsupported Mokly ${boundary} version ${version}; ` +
      `this viewer supports version ${supported}.`,
  );
}
