/**
 * A small two-commit catalogue for the Changes tab journeys whose expected
 * values the comparison copy cannot pin: the change stepper's place and count,
 * and a listed use case with its `Changed step:` line. Every entry sits at the
 * root of its section, so the Changes filter's order is plain to hand-work:
 * folders first, then rows by title, and a removed row after the current rows
 * of its section.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { git, write } from "./static_changes.js";

/**
 * The entries of the catalogue. The Changes filter lists five, in this
 * order: Added screen (1), Details screen (2), Tour (3) and Retired screen
 * (4) in Specs, then Badge (5) in Components. Consumer screen and Welcome
 * screen stay unmodified, so the filter does not list them.
 */
export const changesTabPaths = {
  /** A screen that the branch adds. */
  added: "added",
  /** A component whose stylesheet changes. */
  badge: "badge",
  /** An unmodified screen that uses Badge: eligible, but not listed. */
  consumer: "consumer",
  /** A changed screen: the second step of Tour. */
  details: "details",
  /** A screen that the branch removes. */
  retired: "retired",
  /** A use case that Changes lists, because its second step changed. */
  tour: "tour",
  /** An unmodified screen: the first step of Tour. */
  welcome: "welcome",
} as const;

/** The base that the catalogue compares with, as Compared names it. */
export const changesTabBase = "fixture-base";

/** Tour's steps, as its canvas and its `Changed step:` line name them. */
export const tourSteps = ["Open the welcome", "Check the details"] as const;

type Side = "Before" | "After";

const screen = (title: string, body: string, extra = "") =>
  `---\ntitle: ${title}\n${extra}---\n${body}`;

/** The front matter of a step's screen, which lists the use case. */
const tourStep = `useCasePaths: [${changesTabPaths.tour}]\n`;

const badge = `---
title: Badge
element: ui-badge
propSchema: {type: object, additionalProperties: false, properties: {label: {type: string}}}
props: {label: Badge}
---
<span class="badge-tone">{{label}}</span>`;

const tour = `title: Tour
steps:
  - screenPath: ${changesTabPaths.welcome}
    title: ${tourSteps[0]}
  - screenPath: ${changesTabPaths.details}
    title: ${tourSteps[1]}
`;

/** The sources that differ between the two commits. */
async function writeSide(root: string, side: Side): Promise<void> {
  await write(
    root,
    `specs/${changesTabPaths.details}.screen.html`,
    screen("Details screen", `<h1>Details ${side}</h1>`, tourStep),
  );
  // Only the badge's colour changes, so the change stays inside Badge's
  // instances: Badge is Changed, and Consumer screen stays Unmodified.
  await write(
    root,
    "badge.css",
    `.badge-tone { color: ${side === "Before" ? "rgb(180, 30, 30)" : "rgb(30, 60, 180)"}; }\n`,
  );
}

/** Write exactly two commits in an isolated repository, with a base branch. */
export async function createChangesTabCatalogue(root: string): Promise<void> {
  await write(root, ".gitignore", ".context/\nmokly-static/\n");
  await write(
    root,
    "mokly.config.json",
    JSON.stringify({
      colorSchemes: ["light", "dark"],
      review: { base: changesTabBase },
      stylesheets: [{ match: "**/*.html", stylesheets: ["badge.css"] }],
    }),
  );
  await writeSide(root, "Before");
  await write(
    root,
    `specs/${changesTabPaths.welcome}.screen.html`,
    screen("Welcome screen", "<h1>Welcome</h1>", tourStep),
  );
  await write(
    root,
    `specs/${changesTabPaths.consumer}.screen.html`,
    screen(
      "Consumer screen",
      '<h1>Consumer screen</h1>\n<ui-badge label="New"></ui-badge>',
    ),
  );
  await write(
    root,
    `specs/${changesTabPaths.retired}.screen.html`,
    screen("Retired screen", "<h1>Retired screen</h1>"),
  );
  await write(root, `specs/${changesTabPaths.badge}.component.html`, badge);
  await write(root, `specs/${changesTabPaths.tour}.use-case.yaml`, tour);
  for (const args of [
    ["init", "-q"],
    ["config", "user.name", "Mokly Browser Fixture"],
    ["config", "user.email", "browser@example.test"],
    ["add", "-A"],
    ["commit", "-qm", "Base catalogue"],
    ["branch", changesTabBase],
  ])
    await git(root, ...args);
  await writeSide(root, "After");
  await write(
    root,
    `specs/${changesTabPaths.added}.screen.html`,
    screen("Added screen", "<h1>Added screen</h1>"),
  );
  await fs.rm(path.join(root, `specs/${changesTabPaths.retired}.screen.html`));
  await git(root, "add", "-A");
  await git(root, "commit", "-qm", "Changed catalogue");
}
