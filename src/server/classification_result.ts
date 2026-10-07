import type { ComponentChangeSnapshot } from "./component_change_types.js";

/** Expected unavailable outcome for a baseline built by an earlier Mokly. */
export interface EarlierBaselineClassification {
  readonly kind: "incompatible-earlier";
  readonly commit: string;
}

/** Invalid v7 or unsupported newer baseline reported through Serve diagnostics. */
export interface InvalidBaselineClassification {
  readonly kind: "invalid-baseline";
  readonly diagnostic: string;
}

/** Every terminal result from optional background Changes classification. */
export type CatalogueChangeClassification =
  | ComponentChangeSnapshot
  | EarlierBaselineClassification
  | InvalidBaselineClassification
  | undefined;

export function isEarlierBaselineClassification(
  value: CatalogueChangeClassification,
): value is EarlierBaselineClassification {
  return Boolean(
    value && "kind" in value && value.kind === "incompatible-earlier",
  );
}

export function isInvalidBaselineClassification(
  value: CatalogueChangeClassification,
): value is InvalidBaselineClassification {
  return Boolean(value && "kind" in value && value.kind === "invalid-baseline");
}
