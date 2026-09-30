import type { ComparisonScope } from "./comparison_request.js";

/** Available comparison presentations; Current never makes a request. */
export type ComparisonMode = "current" | "side" | "overlay" | "difference";

/** Axes and mode for the comparison artifact currently shown. */
export interface ComparisonPresentation {
  /** Scheme of the comparison artifact actually shown. */
  colorScheme: "dark" | "light";
  mode: Exclude<ComparisonMode, "current">;
  /** Sticky control selection retained for fallback labels. */
  requestedColorScheme: "dark" | "light";
  viewport: "both" | "desktop" | "mobile";
}

/** One exact comparison request derived from the current presentation. */
export interface ComparisonDemand extends ComparisonPresentation {
  key: string;
  scope: ComparisonScope;
  scopeKey: string;
}

/** Build a stable request key for one comparison presentation. */
export function comparisonDemand(
  scope: ComparisonScope,
  scopeKey: string,
  mode: Exclude<ComparisonMode, "current">,
  viewport: ComparisonPresentation["viewport"],
  colorScheme: ComparisonPresentation["colorScheme"],
  requestedColorScheme: ComparisonPresentation["requestedColorScheme"],
): ComparisonDemand {
  return {
    scope,
    scopeKey,
    mode,
    viewport,
    colorScheme,
    requestedColorScheme,
    key: JSON.stringify([
      scopeKey,
      mode,
      viewport,
      colorScheme,
      requestedColorScheme,
    ]),
  };
}
