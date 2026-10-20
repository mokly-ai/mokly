/**
 * Stylesheet evidence groups of the default comparison copy, written once per
 * commit through `writeGroups`. They serve the page, component and history
 * evidence specs: a changed handbook page whose stylesheets change, with an
 * Action instance that the shared sheet also styles on Action's own
 * documents; an unchanged notes page whose stylesheet change matches nothing
 * on it; a page that moves to a new path with similar text; a Toolbar that
 * consumes Card; and a stylesheet that only Card's own documents link.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { write } from "./static_changes.js";

type Side = "Before" | "After";

/** The evidence group entries' current paths, merged into `comparisonPaths`. */
export const evidencePaths = {
  changedPage: "pages/handbook",
  unchangedPage: "pages/notes",
  movedPage: "pages/guidebook",
  pageComponent: "components/action",
  consumingComponent: "components/toolbar",
} as const;

/** The moved page's path at the fixture base; it has no removed record. */
export const movedPageBase = "pages/manual";

/** The evidence groups' stylesheet rules, before the catch-all rule. */
export const evidenceStylesheets = [
  { match: "components/action/**", stylesheets: ["theme.css", "actions.css"] },
  { match: "components/card/**", stylesheets: ["theme.css", "card.css"] },
];

/** The stylesheets that the pages link, as the shell names them. */
export const pageStylesheets = {
  actions: "static/mokly-generated/styles/actions.css",
  handbook: "static/styles/handbook.css",
  notes: "static/styles/notes.css",
} as const;

/** One colour per side, so every changed rule differs between the commits. */
const tone = (side: Side) =>
  side === "Before" ? "rgb(180, 30, 30)" : "rgb(30, 60, 180)";

/**
 * A whole page document that links `hrefs`. A page's links resolve against its
 * route under `static/mokly-generated/`: `../../` reaches a configured
 * stylesheet's route, and `../../../` an authored file in the repository.
 */
const page = (title: string, hrefs: readonly string[], body: string) =>
  `---\ntitle: ${title}\n---\n<!doctype html><html><head><title>${title}</title>${hrefs
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("")}</head><body>${body}</body></html>`;

/** The moved page's text: its title changes, and its steps stay the same. */
const manual = (title: string) =>
  page(
    title,
    [],
    `<main><h1>${title}</h1>\n<p>Install the app.</p>\n<p>Open a workspace.</p>\n<p>Invite your team.</p>\n<p>Share a catalogue.</p></main>`,
  );

/** Write every evidence group's sources for one commit. */
export async function writeEvidenceGroups(
  root: string,
  side: Side,
): Promise<void> {
  // The handbook's sheets: a rule that styles Action and the page's own
  // element, a page-only rule, and a custom property that can reach anything.
  await write(root, "actions.css", `.action { color: ${tone(side)}; }\n`);
  await write(
    root,
    "styles/handbook.css",
    `article h2 { color: ${tone(side)}; }\n:root { --tone: ${side === "Before" ? "rgb(0, 0, 200)" : "rgb(200, 0, 0)"}; }\n`,
  );
  await write(
    root,
    "specs/pages/handbook.page.html",
    page(
      "Getting started",
      ["../../styles/actions.css", "../../../styles/handbook.css"],
      '<article><h1>Getting started</h1><h2>Next steps</h2><p><span class="action">Open</span></p></article><ui-action label="Continue"></ui-action>',
    ),
  );
  // The notes sheet changes a rule that matches nothing on its page.
  await write(root, "styles/notes.css", `.missing { color: ${tone(side)}; }\n`);
  await write(
    root,
    "specs/pages/notes.page.html",
    page("Notes", ["../../../styles/notes.css"], "<main><h1>Notes</h1></main>"),
  );
  await write(
    root,
    "specs/components/action.component.html",
    '---\ntitle: Action\nelement: ui-action\npropSchema: {type: object, additionalProperties: false, properties: {label: {type: string}}}\nprops: {label: Continue}\n---\n<button class="action">{{label}}</button>',
  );
  await write(
    root,
    "specs/components/toolbar.component.html",
    '---\ntitle: Toolbar\nelement: ui-toolbar\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<div class="toolbar"><ui-card label="Toolbar card"></ui-card></div>',
  );
  // Card's own sheet: a rule on Card's element and a custom property.
  await write(
    root,
    "card.css",
    `.accent { border-color: ${tone(side)}; }\n:root { --card-tone: ${tone(side)}; }\n`,
  );
  // The manual moves to the guidebook path and keeps most of its text.
  if (side === "Before")
    await write(
      root,
      `specs/${movedPageBase}.page.html`,
      manual("User manual"),
    );
  else {
    await fs.rm(path.join(root, `specs/${movedPageBase}.page.html`));
    await write(
      root,
      `specs/${evidencePaths.movedPage}.page.html`,
      manual("User guidebook"),
    );
  }
}
