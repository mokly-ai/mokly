import type { ComparisonAdditions } from "./comparison_catalogue.js";
import { write } from "./static_changes.js";

/** Entries of the copy whose component changes only where a screen uses it. */
export const implementationPaths = {
  component: "impact/chip",
  consumer: "impact/board",
} as const;

/**
 * A chip whose saved example leaves `urgent` unset, so its own views render
 * the same on both sides. Board sets `urgent`, and the second commit
 * rewords only that branch, so the change shows only where Board uses it.
 */
const chip = (side: "Before" | "After") => `---
title: Chip
element: ui-chip
propSchema: {type: object, additionalProperties: false, required: [label], properties: {label: {type: string}, urgent: {type: boolean}}}
props: {label: Chip}
---
<span class="impact-chip">{{label}}<strong mokly-if="$urgent"> · ${side === "Before" ? "Urgent" : "Due now"}</strong></span>`;

const board = `---
title: Board
---
<h1>Board</h1>
<ui-chip label="Invoice" urgent="true"></ui-chip>`;

/** Add the chip and its consumer before each commit of a comparison copy. */
export const addImplementationSources: ComparisonAdditions = async (
  root,
  side,
) => {
  await write(
    root,
    `specs/${implementationPaths.component}.component.html`,
    chip(side),
  );
  await write(root, `specs/${implementationPaths.consumer}.screen.html`, board);
};
