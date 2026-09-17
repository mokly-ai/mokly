/** A strictly parsed browsing-context request. */
export type BrowsingTarget =
  | { kind: "blank" }
  | { kind: "invalid" }
  | { kind: "named"; name: string }
  | { kind: "parent" }
  | { kind: "self" }
  | { kind: "top" };

const NAMED_TARGET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** Parse a live or derived target without trimming or browser inference. */
export function parseBrowsingTarget(
  value: string | null | undefined,
): BrowsingTarget {
  if (value === undefined || value === null || value === "") {
    return { kind: "self" };
  }
  const keyword = value.toLowerCase();
  if (keyword === "_self") return { kind: "self" };
  if (keyword === "_top") return { kind: "top" };
  if (keyword === "_parent") return { kind: "parent" };
  if (keyword === "_blank") return { kind: "blank" };
  if (NAMED_TARGET_PATTERN.test(value)) return { kind: "named", name: value };
  return { kind: "invalid" };
}

/** Serialize a valid non-self target for trusted inert metadata. */
export function serializeBrowsingTarget(
  target: BrowsingTarget,
): string | undefined {
  if (target.kind === "top") return "_top";
  if (target.kind === "parent") return "_parent";
  if (target.kind === "blank") return "_blank";
  if (target.kind === "named") return target.name;
  return undefined;
}
