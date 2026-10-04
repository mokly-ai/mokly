/** Fail closed before origin options can reach a listener or private descriptor. */

import { MoklyError } from "../errors.js";
import { isCanonicalHttpOrigin } from "../http_origin.js";

/** Check programmatic Serve options with the same allowlist used by the CLI. */
export function validateServeOrigins(options: {
  appOrigin?: string;
  interactiveOrigin?: string;
}): void {
  for (const [option, value] of [
    ["--app-origin", options.appOrigin],
    ["--interactive-origin", options.interactiveOrigin],
  ] as const)
    if (value !== undefined && !isCanonicalHttpOrigin(value))
      throw new MoklyError(
        "server-failed",
        `${option} must be a canonical HTTP(S) origin with a valid hostname or IP literal`,
      );
}
