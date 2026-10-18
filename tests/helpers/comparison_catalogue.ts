import fs from "node:fs/promises";
import path from "node:path";

import { git, write } from "./static_changes.js";

/** Stable authored entries for copied comparison and viewer UI journeys. */
export const comparisonPaths = {
  changed: "screens/changed",
  unchanged: "screens/stable",
  component: "components/card",
  removedScreen: "screens/retired",
  removedPage: "pages/retired",
  removedDocument: "notes/retired",
  removedComponent: "components/retired",
  removedVariant: "components/card/archived",
} as const;

const screen = (title: string, body: string) =>
  `---\ntitle: ${title}\n---\n${body}`;
const card = (variants: boolean) => `---
title: Card
element: ui-card
propSchema: {type: object, additionalProperties: false, properties: {}}
${variants ? "variants: [{slug: archived, title: Archived, props: {}}]\n" : ""}---
<article class="accent"><h2>Card content</h2></article>`;
const content = (side: "Before" | "After") => `<main>
<h1>${side} screen</h1>
<p class="accent">A stylesheet-owned change</p>
<ui-card></ui-card>
<section id="panel" style="height:160px;overflow:auto"><div style="height:480px">Scrollable panel ${side}</div></section>
<div style="height:1200px">Long page ${side}</div>
<a href="#end">Jump to the end</a><h2 id="end">End ${side}</h2>
</main>`;

/** Write exactly two commits in an isolated repository; never read checkout history. */
export async function createComparisonCatalogue(root: string): Promise<void> {
  await write(root, ".gitignore", ".context/\nmokly-static/\n");
  await write(
    root,
    "mokly.config.json",
    JSON.stringify({
      colorSchemes: ["light", "dark"],
      review: { base: "fixture-base" },
      stylesheets: [{ match: "**/*.html", stylesheets: ["theme.css"] }],
    }),
  );
  await write(root, "theme.css", ".accent { color: rgb(180, 30, 30); }\n");
  await write(
    root,
    "specs/screens/changed.screen.html",
    screen("Changed screen", content("Before")),
  );
  await write(
    root,
    "specs/screens/stable.screen.html",
    screen("Stable screen", "<h1>Stable screen</h1>"),
  );
  await write(root, "specs/components/card.component.html", card(true));
  await write(
    root,
    "specs/screens/retired.screen.html",
    screen("Retired screen", "<h1>Historical screen</h1>"),
  );
  await write(
    root,
    "specs/pages/retired.page.html",
    screen(
      "Retired page",
      "<!doctype html><html><head><title>Retired page</title></head><body><h1>Historical page</h1></body></html>",
    ),
  );
  await write(
    root,
    "specs/notes/retired.md",
    "---\ntitle: Retired document\n---\n# Historical document\n",
  );
  await write(
    root,
    "specs/components/retired.component.html",
    `---
title: Retired component
element: ui-retired
propSchema: {type: object, additionalProperties: false, properties: {}}
---
<p>Historical component</p>`,
  );
  for (const args of [
    ["init", "-q"],
    ["config", "user.name", "Mokly Browser Fixture"],
    ["config", "user.email", "browser@example.test"],
    ["add", "-A"],
    ["commit", "-qm", "Base catalogue"],
    ["branch", "fixture-base"],
  ])
    await git(root, ...args);
  await write(
    root,
    "specs/screens/changed.screen.html",
    screen("Changed screen", content("After")),
  );
  await write(root, "theme.css", ".accent { color: rgb(30, 60, 180); }\n");
  await write(root, "specs/components/card.component.html", card(false));
  for (const file of [
    "screens/retired.screen.html",
    "pages/retired.page.html",
    "notes/retired.md",
    "components/retired.component.html",
  ])
    await fs.rm(path.join(root, "specs", file));
  await git(root, "add", "-A");
  await git(root, "commit", "-qm", "Changed catalogue");
}
