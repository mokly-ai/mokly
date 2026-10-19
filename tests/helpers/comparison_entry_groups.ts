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
  lightOnlyParent: "components/lamp",
  lightOnlyVariant: "components/lamp/on",
  atRuleChange: "screens/fade",
  mobileOnlyChange: "screens/compact",
  ...scrollPaths,
} as const;

/** The groups' stylesheet rules, which come before the catch-all rule. */
export const groupStylesheets = [
  {
    match: "{screens,components}/plain/index.html",
    stylesheets: ["plain.css"],
  },
  { match: "screens/fade/index.html", stylesheets: ["fade.css"] },
  { match: "screens/compact/index.html", stylesheets: ["compact.css"] },
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
  // Light only: a component with Light views only and a changed variant.
  await write(
    root,
    "specs/components/lamp.component.html",
    `---\ntitle: Lamp\nelement: ui-lamp\ncolorSchemes: [light]\npropSchema: {type: object, additionalProperties: false, properties: {label: {type: string}}}\nprops: {label: Lamp}\nvariants: [{slug: on, title: On, props: {label: Lamp on ${side}}}]\n---\n<p class="lamp">{{label}}</p>`,
  );
  // CSS evidence: a changed selector-less at-rule, and a changed rule that
  // matches only the mobile view.
  const after = side === "After";
  await write(
    root,
    "fade.css",
    `@keyframes fixture-fade { from { opacity: 1; } to { opacity: ${after ? 0.6 : 0.8}; } }\n`,
  );
  await write(
    root,
    "specs/screens/fade.screen.html",
    "---\ntitle: Fade screen\n---\n<h1>Fade screen</h1>",
  );
  await write(root, "compact.css", `.auth { padding: ${after ? 2 : 1}px; }\n`);
  await write(
    root,
    "specs/screens/compact.screen.html",
    '---\ntitle: Compact screen\n---\n<main><h1>Compact screen</h1><button class="auth" mokly-viewport="mobile">Sign in</button></main>',
  );
  await writeScrollGroups(root, side);
}
