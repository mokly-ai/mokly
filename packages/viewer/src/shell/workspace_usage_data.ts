/** One routed use of, or consumer affected by, a component. */
export interface UsageLink {
  entryId: string;
  entryKind: "component" | "screen";
  title: string;
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
  instanceKey: string;
  direct: boolean;
  removed: boolean;
  comparisonEligible: boolean;
}
