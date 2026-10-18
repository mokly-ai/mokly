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
  consumer: "screens/consumer",
  changedVariant: "components/card/featured",
  addedVariant: "components/card/fresh",
  quietParent: "components/tag",
  quietSibling: "components/tag/plain",
  quietVariant: "components/tag/bold",
  quietRemoved: "components/tag/old",
  added: "screens/added",
  darkOnly: "screens/dusk",
} as const;

type Side = "Before" | "After";

const screen = (title: string, body: string) =>
  `---\ntitle: ${title}\n---\n${body}`;
const component = (
  title: string,
  element: string,
  variants: string,
  body: string,
) => `---
title: ${title}
element: ${element}
propSchema: {type: object, additionalProperties: false, properties: {label: {type: string}}}
props: {label: ${title} content}
variants: [${variants}]
---
${body}`;
const card = (side: Side) =>
  component(
    "Card",
    "ui-card",
    side === "Before"
      ? "{slug: featured, title: Featured, props: {label: Featured Before}}, {slug: archived, title: Archived, props: {}}"
      : "{slug: featured, title: Featured, props: {label: Featured After}}, {slug: fresh, title: Fresh, props: {label: Fresh card}}",
    '<article class="accent"><h2>{{label}}</h2></article>',
  );
const tag = (side: Side) =>
  component(
    "Tag",
    "ui-tag",
    `{slug: plain, title: Plain, props: {label: Plain tag}}, {slug: bold, title: Bold, props: {label: Bold ${side}}}${side === "Before" ? ", {slug: old, title: Old tag, props: {label: Old tag}}" : ""}`,
    '<span class="tag">{{label}}</span><div style="height:1400px">Tag body</div>',
  );
/**
 * The changed screen: a shorter Before page and panel, a panel link, a
 * catalogue link, and an anchor whose target can reach the viewport top.
 */
const content = (side: Side) => `<main>
<h1>${side} screen</h1>
<a id="snapshot-link" href="mock:screens/stable">Open the stable screen</a>
<a id="jump" href="#end">Jump to the end</a>
<p class="accent">A stylesheet-owned change</p>
<ui-card label="Card content"></ui-card>
<section id="panel" aria-label="Scrollable panel" style="height:160px;overflow:auto"><div style="height:${side === "Before" ? 480 : 640}px">Scrollable panel ${side}<a id="panel-link" href="#panel-end" style="display:block;margin-top:320px">Panel link</a><p id="panel-end">Panel end ${side}</p></div></section>
<div style="height:${side === "Before" ? 900 : 1500}px">Long page ${side}</div>
<h2 id="end">End ${side}</h2>
<div style="height:1200px">After the end</div>
</main>`;

/** The side-dependent sources, written once per commit. */
async function writeSide(root: string, side: Side): Promise<void> {
  const before = side === "Before";
  await write(
    root,
    "specs/screens/changed.screen.html",
    screen("Changed screen", content(side)),
  );
  await write(
    root,
    "theme.css",
    `.accent { color: ${before ? "rgb(180, 30, 30)" : "rgb(30, 60, 180)"}; }\n`,
  );
  await write(
    root,
    "changed.css",
    `:root { --page-tint: ${before ? "rgb(250, 250, 250)" : "rgb(244, 246, 250)"}; }\n`,
  );
  await write(
    root,
    "dusk.css",
    `.dusk { color: ${before ? "rgb(200, 200, 200)" : "rgb(240, 200, 120)"}; }\n`,
  );
  await write(root, "specs/components/card.component.html", card(side));
  await write(root, "specs/components/tag.component.html", tag(side));
}

/** Write exactly two commits in an isolated repository; never read checkout history. */
export async function createComparisonCatalogue(root: string): Promise<void> {
  await write(root, ".gitignore", ".context/\nmokly-static/\n");
  await write(
    root,
    "mokly.config.json",
    JSON.stringify({
      colorSchemes: ["light", "dark"],
      review: { base: "fixture-base" },
      stylesheets: [
        {
          match: "screens/changed/index.html",
          stylesheets: ["theme.css", "changed.css"],
        },
        {
          match: "screens/dusk/index.html",
          stylesheets: ["theme.css"],
          darkStylesheets: ["dusk.css"],
        },
        { match: "**/*.html", stylesheets: ["theme.css"] },
      ],
    }),
  );
  await writeSide(root, "Before");
  await write(
    root,
    "specs/screens/stable.screen.html",
    "---\ntitle: Stable screen\ncolorSchemes: [light]\n---\n<h1>Stable screen</h1>",
  );
  await write(
    root,
    "specs/screens/consumer.screen.html",
    screen(
      "Consumer screen",
      '<h1>Consumer screen</h1>\n<ui-card label="Card content"></ui-card>',
    ),
  );
  await write(
    root,
    "specs/screens/dusk.screen.html",
    screen("Dusk screen", '<h1 class="dusk">Dusk screen</h1>'),
  );
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
      `<!doctype html><html><head><title>Retired page</title></head><body><h1>Historical page</h1>
<p><a href="mock:screens/stable">Marked catalogue link</a></p>
<p><a href="https://example.com/elsewhere">External link</a></p>
<p><a href="https://example.com/report.txt" download>Download link</a></p>
<svg width="160" height="24"><a href="https://example.com/svg"><text x="0" y="16">SVG link</text></a></svg>
<form action="https://example.com/form" method="get"><button>Send</button></form>
<p><a href="#foot">Jump to the end</a></p>
<div style="height:2400px">Historical body</div>
<p id="foot">Historical end</p>
</body></html>`,
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
  await writeSide(root, "After");
  await write(
    root,
    "specs/screens/added.screen.html",
    screen("Added screen", "<h1>Added screen</h1>"),
  );
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
