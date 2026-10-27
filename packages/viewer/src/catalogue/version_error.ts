/**
 * The one headline of a rejected viewer boundary in every host; version
 * numbers stay in the diagnostic.
 */
export const VERSION_ERROR_MESSAGE = "This catalogue needs a compatible viewer";

/** A wire-format version rejected before the viewer interprets paths or entries. */
export class MoklyVersionError extends Error {
  readonly code = "unsupported-mokly-version";

  constructor(
    readonly boundary: "catalogue" | "detail" | "live",
    readonly version: unknown,
    readonly supported: number,
  ) {
    super(
      `Unsupported Mokly ${boundary} version ${String(version)}; this viewer supports version ${supported}.`,
    );
    this.name = "MoklyVersionError";
  }
}
