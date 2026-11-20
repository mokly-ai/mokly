/** One composition of a viewer drawing. */
export interface SlotBar {
  compact: boolean;
  /** The class that `viewer-bar.css` shows in this composition only. */
  part?: "fo-full-bar-only" | "fo-compact-bar-only";
}

/**
 * The compositions a viewer drawing uses. A phone draws the compact bar
 * only. A desktop drawing draws both, and the switch in `viewer.css` shows the
 * one that the bar's own width holds, as the App's bar chooses.
 */
export function slotBars(viewport: "mobile" | "desktop"): readonly SlotBar[] {
  if (viewport === "mobile") return [{ compact: true }];
  return [
    { compact: false, part: "fo-full-bar-only" },
    { compact: true, part: "fo-compact-bar-only" },
  ];
}

/** The class of one published slot in one composition. */
export function slotClass(
  side: "fo-package-slot-start" | "fo-package-slot-end",
  bar: SlotBar,
): string {
  return [
    "fo-package-slot",
    side,
    bar.compact ? "fo-package-slot-compact" : undefined,
    bar.part,
  ]
    .filter((name) => name !== undefined)
    .join(" ");
}

/**
 * The compact bar's name for a reference: a pull request's number, or the
 * last segment of a branch.
 */
export function compactLabel(label: string): string {
  const slash = label.lastIndexOf("/");
  const space = label.indexOf(" ");
  if (label.startsWith("#") && space > 0) return label.slice(0, space);
  return slash >= 0 ? label.slice(slash + 1) : label;
}
