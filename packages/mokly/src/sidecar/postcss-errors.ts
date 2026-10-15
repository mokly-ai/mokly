import type { PostcssFailure } from "../generated/sidecar/PostcssFailure.js";

import { detail } from "./errors.js";

/** Worker failures retain structured context until Rust selects the terminal text. */
export class PostcssError extends Error {
  constructor(readonly failure: PostcssFailure) {
    super(
      "detail" in failure ? failure.detail : `PostCSS ${failure.kind} failure`,
    );
  }
}

/** Keep CSS coordinates while removing PostCSS's physical-path framing. */
export function pluginFailure(
  error: unknown,
  stylesheet: string,
): PostcssError {
  const plugin =
    error &&
    typeof error === "object" &&
    "plugin" in error &&
    typeof error.plugin === "string"
      ? error.plugin
      : "unknown";
  let cause = error;
  while (cause instanceof Error && cause.cause !== undefined)
    cause = cause.cause;
  if (
    cause instanceof Error &&
    cause.name === "CssSyntaxError" &&
    "reason" in cause &&
    typeof cause.reason === "string"
  ) {
    if (
      "line" in cause &&
      typeof cause.line === "number" &&
      "column" in cause &&
      typeof cause.column === "number"
    )
      stylesheet += `:${cause.line}:${cause.column}`;
    return new PostcssError({
      kind: "plugin",
      plugin,
      stylesheet,
      detail: cause.reason,
    });
  }
  return new PostcssError({
    kind: "plugin",
    plugin,
    stylesheet,
    detail: detail(error),
  });
}
