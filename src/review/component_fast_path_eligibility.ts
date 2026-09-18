/** Cheap conservative eligibility checks for unchanged component views. */

import type { ComponentViewRecord } from "@mokly/viewer";

const TEMPLATE_OPEN = /<template\b/i;

/** Whether projection may expose caller-owned content from an inert template. */
export function mayProjectCallerSlotFromTemplate(
  html: string,
  usage: ComponentViewRecord | undefined,
): boolean {
  if (!usage?.slots.some((slot) => slot.owner.kind === "entry")) return false;
  return TEMPLATE_OPEN.test(html);
}
