/** A wire-format version rejected before the viewer interprets paths or entries. */
export class MoklyVersionError extends Error {
  readonly code = "unsupported-mokly-version";

  constructor(
    readonly boundary: "catalogue" | "delivery" | "bootstrap",
    readonly version: unknown,
    readonly supported: number,
  ) {
    super(
      `Unsupported Mokly ${boundary} version ${String(version)}; this viewer supports version ${supported}.`,
    );
    this.name = "MoklyVersionError";
  }
}
