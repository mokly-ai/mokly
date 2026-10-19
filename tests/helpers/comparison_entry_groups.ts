/**
 * Entry groups of the default comparison copy. `writeSide` in
 * `comparison_catalogue.ts` writes them once per commit, so a group can
 * change an entry between the two commits.
 */

import {
  scrollPaths,
  scrollStylesheets,
  writeScrollGroups,
} from "./comparison_scroll_groups.js";
import { write } from "./static_changes.js";

type Side = "Before" | "After";

/** The group entries' paths, merged into `comparisonPaths`. */
export const groupPaths = {
  folderIndex: "account",
  folderChanged: "account/security",
  folderQuiet: "account/alerts",
  currentDocument: "guides/terms",
  plainScreen: "screens/plain",
  plainComponent: "components/plain",
  ...scrollPaths,
} as const;

/** The groups' stylesheet rules, which come before the catch-all rule. */
export const groupStylesheets = [
  {
    match: "{screens,components}/plain/index.html",
    stylesheets: ["plain.css"],
  },
  ...scrollStylesheets,
];

/**
 * A current document with a catalogue link, filler that puts its Overview
 * heading below the fold, and that heading.
 */
const terms = `---
title: Payment terms
---
# Payment terms

[Open the stable screen](mock:screens/stable)

${Array.from({ length: 40 }, (_, index) => `Paragraph ${index + 1} of the payment terms.`).join("\n\n")}

## Overview

Every invoice is due 30 days after it is issued.
`;

/** Write every group's sources for one commit. */
export async function writeGroups(root: string, side: Side): Promise<void> {
  // Documents: a screen index whose folder holds a changed and an unmodified
  // member, and the current document that the index names as related.
  await write(
    root,
    "specs/account/index.screen.html",
    "---\ntitle: Account\nrelatedDocs: [specs/guides/terms.md]\n---\n<h1>Account</h1>",
  );
  await write(
    root,
    "specs/account/security.screen.html",
    `---\ntitle: Security\n---\n<h1>Security ${side}</h1>`,
  );
  await write(
    root,
    "specs/account/alerts.screen.html",
    "---\ntitle: Alerts\n---\n<h1>Alerts</h1>",
  );
  await write(root, "specs/guides/terms.md", terms);
  // Shared impact: an unreferenced file that the second commit edits, and a
  // screen and a component whose only stylesheet stays the same.
  await write(root, "notes.txt", `${side} notes\n`);
  await write(root, "plain.css", ".plain { color: rgb(20, 20, 20); }\n");
  await write(
    root,
    "specs/screens/plain.screen.html",
    '---\ntitle: Plain screen\n---\n<h1 class="plain">Plain screen</h1>',
  );
  await write(
    root,
    "specs/components/plain.component.html",
    '---\ntitle: Plain\nelement: ui-plain\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<p class="plain">Plain component</p>',
  );
  await writeScrollGroups(root, side);
}
