/**
 * Scroll groups of the default comparison copy, written once per commit
 * through `writeGroups`. They serve the alignment and region specs: a tall
 * screen with a sticky header, a viewport-height hero, a late image, and a
 * fixed bar; an app shell screen whose page never scrolls; a regions shell
 * with a horizontal timeline and one panel for each pairing rule; a regions
 * page with a focusable code panel, a right-to-left strip, and a two-axis
 * grid; and a component whose list scrolls.
 */

import { write } from "./static_changes.js";

type Side = "Before" | "After";

/** The scroll group entries' paths, merged into `comparisonPaths`. */
export const scrollPaths = {
  tall: "screens/tall",
  appShell: "screens/app-shell",
  regionsShell: "screens/regions",
  regionsPage: "screens/regions-page",
  taskList: "components/tasks",
  taskListVariant: "components/tasks/list",
} as const;

/** The scroll groups' stylesheet rules, before the catch-all rule. */
export const scrollStylesheets = [
  {
    match: "screens/{tall,app-shell}/index.html",
    stylesheets: ["alignment.css"],
  },
  {
    match:
      "{screens/regions/index.html,screens/regions-page/index.html,components/tasks/**}",
    stylesheets: ["regions.css"],
  },
];

/** The late image's rendered height once it loads: 10×120 shown 100px wide. */
export const LATE_IMAGE_HEIGHT = 1200;

const ALIGNMENT_CSS = `body { margin: 0; font: 16px/1.5 sans-serif; background: rgb(250, 250, 250); }
.al-header { position: sticky; top: 0; z-index: 1; height: 48px; margin: 0; background: rgb(221, 238, 255); }
.al-hero { min-height: 100vh; margin: 0; padding: 16px; background: rgb(255, 238, 221); }
.al-block { height: 300px; margin: 0; padding: 16px; }
.al-target { height: 300px; margin: 0; background: rgb(221, 255, 221); }
.al-late { display: block; width: 100px; }
.al-bar { position: fixed; left: 0; right: 0; bottom: 0; height: 40px; margin: 0; background: rgb(34, 51, 68); color: white; }
html:has(.al-inner), body:has(.al-inner) { height: 100%; overflow: hidden; }
.al-inner { height: 100vh; overflow: auto; margin: 0; }
.al-inner-content { height: 2000px; margin: 0; }
`;

const REGIONS_CSS = `body { margin: 0; font: 16px/1.5 sans-serif; background: rgb(250, 250, 250); }
html:has(.rg-shell), body:has(.rg-shell) { height: 100%; overflow: hidden; }
.rg-shell { display: grid; grid-template-columns: 180px minmax(0, 1fr) 220px; grid-template-rows: 48px minmax(0, 1fr) 120px; height: 100vh; }
.rg-bar { grid-column: 1 / -1; margin: 0; background: rgb(221, 238, 255); }
.rg-left { display: grid; grid-template-rows: minmax(0, 1fr) 140px; min-height: 0; }
.rg-nav, .rg-log, .rg-main, .rg-panel, .rg-queue, .rg-code, .rg-grid, .rg-tasks { overflow: auto; min-height: 0; margin: 0; padding: 0; }
.rg-list, .rg-tasks { margin: 0; padding: 0; list-style: none; }
.rg-line, .rg-task { height: 40px; margin: 0; overflow: hidden; white-space: nowrap; }
.rg-intro { height: 120px; margin: 0; }
.rg-strip, .rg-rtl { height: 80px; overflow-x: auto; overflow-y: hidden; margin: 0; }
.rg-track { width: 2000px; height: 60px; margin: 0; }
.rg-block { height: 300px; margin: 0; overflow: hidden; }
.rg-deep { height: 40px; margin: 0; }
.rg-right { display: grid; grid-template-rows: repeat(6, minmax(0, 1fr)); min-height: 0; }
.rg-s1 { grid-row: 1; } .rg-s2 { grid-row: 2; } .rg-s3 { grid-row: 3; } .rg-s4 { grid-row: 4; } .rg-s5 { grid-row: 5; } .rg-s6 { grid-row: 6; }
.rg-footer { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); min-height: 0; margin: 0; }
.rg-queue-whole { grid-column: 1 / 3; }
.rg-page-title { height: 60px; margin: 0; }
.rg-code { display: block; height: 200px; font: 16px/20px monospace; }
.rg-code-line { display: block; height: 20px; }
.rg-rtl { width: 400px; }
.rg-grid { width: 300px; height: 200px; }
.rg-grid-content { width: 900px; height: 700px; margin: 0; }
.rg-tasks { height: 200px; }
@media (max-width: 600px) {
  .rg-shell { grid-template-columns: 110px minmax(0, 1fr); grid-template-rows: 48px minmax(0, 1fr); }
  .rg-right, .rg-footer { display: none; }
}
`;

const LATE_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="120"><rect width="10" height="120" fill="rgb(120, 140, 160)"/></svg>\n';

const WORDS = {
  activityBefore:
    "merged payments refactor opened ticket reviewed onboarding copy archived sprint",
  activityAfter:
    "approved release branch resolved incident drafted roadmap updated pricing table",
  fresh: "cobalt ember quartz tundra marble nectar opal prism radish sable",
  log: "booted cache warmed listener attached worker idle heartbeat rotated journal",
  notes:
    "glacier harbor lantern meadow pebble quiver ribbon saddle thimble umber",
  queue: "nightly build deploy staging rotate keys vacuum tables export audit",
  tips: "orchid falcon velvet summit tangerine walnut yonder zephyr basalt canyon",
} as const;

const screen = (title: string, body: string) =>
  `---\ntitle: ${title}\n---\n${body}`;
const times = (count: number, line: (index: number) => string) =>
  Array.from({ length: count }, (_, index) => line(index)).join("");
/** Ten fixed-height lines: the panel's title word and one word each. */
const panel = (tag: string, attributes: string, title: string, words: string) =>
  `<${tag} ${attributes}>${words
    .split(" ")
    .map((word) => `<p class="rg-line">${title} ${word}</p>`)
    .join("")}</${tag}>`;

function tall(side: Side): string {
  const blocks = times(
    6,
    (index) =>
      `<section class="al-block" id="al-block-${index + 1}">${index === 2 ? side : "Shared"} block ${index + 1}</section>`,
  );
  return `<main class="al-page"><header class="al-header">Alignment header</header><section class="al-hero"><h1>${side} tall</h1><p><a id="al-jump" href="#al-target">Jump to target</a></p></section>${blocks}<section class="al-target" id="al-target">Target section</section><img class="al-late" id="al-late" src="../../../alignment-late.svg" alt=""><footer class="al-bar">Fixed bar</footer></main>`;
}

/** Projects by landmark and label, a main panel by landmark with a named timeline, Activity by id, Notes with changed classes, Tips by text alone, an ambiguous Queue, an off Log, and a new Fresh panel. */
function regionsShell(side: Side): string {
  const after = side === "After";
  const projects = times(
    40,
    (index) =>
      `<li class="rg-line">${after && index === 3 ? "Project renamed" : `Project ${index + 10}`}</li>`,
  );
  const deep = (index: number) =>
    index === 4
      ? '<button id="rg-focus" type="button">Deep action</button>'
      : index === 6
        ? '<h2 class="rg-deep" id="rg-deep">Deep target</h2>'
        : `Section ${index + 10} body`;
  const blocks = times(
    after ? 8 : 10,
    (index) =>
      `<section class="rg-block" id="rg-block-${index}">${deep(index)}</section>`,
  );
  const main = `<main class="rg-main"><p class="rg-intro">${side} overview text</p><div class="rg-strip" data-mokly-scroll="timeline" id="strip-${side.toLowerCase()}"><p class="rg-track">${side} timeline</p></div>${blocks}</main>`;
  const activity = after
    ? panel(
        "section",
        'class="rg-panel rg-s6" id="activity"',
        "Activity",
        WORDS.activityAfter,
      )
    : panel(
        "section",
        'class="rg-panel rg-s1" id="activity"',
        "Activity",
        WORDS.activityBefore,
      );
  const notes = panel(
    "div",
    `class="rg-panel rg-s2 ${after ? "rg-notes-new" : "rg-notes-old"}"`,
    "Notes",
    WORDS.notes,
  );
  const tips = after
    ? panel("article", 'class="rg-panel rg-s5 rg-tips"', "Tips", WORDS.tips)
    : panel("div", 'class="rg-panel rg-s3 rg-tips"', "Tips", WORDS.tips);
  const fresh = after
    ? panel("div", 'class="rg-panel rg-s4 rg-fresh"', "Fresh", WORDS.fresh)
    : "";
  const queues = after
    ? panel("div", 'class="rg-queue rg-queue-a"', "Queue", WORDS.queue) +
      panel("div", 'class="rg-queue rg-queue-b"', "Queue", WORDS.queue)
    : panel("div", 'class="rg-queue rg-queue-whole"', "Queue", WORDS.queue);
  const log = panel(
    "div",
    `class="rg-log"${after ? ' data-mokly-scroll="off"' : ""}`,
    "Log",
    WORDS.log,
  );
  return `<div class="rg-shell"><header class="rg-bar">${side} regions</header><div class="rg-left"><nav aria-label="Projects" class="rg-nav"><ul class="rg-list">${projects}</ul></nav>${log}</div>${main}<div class="rg-right">${activity}${notes}${tips}${fresh}</div><footer class="rg-footer">${queues}</footer></div>`;
}

function regionsPage(side: Side): string {
  const code = times(
    30,
    (index) => `<span class="rg-code-line">${side} line ${index + 10}</span>`,
  );
  const blocks = times(
    10,
    (index) =>
      `<section class="rg-block">${side} page block ${index + 10}</section>`,
  );
  return `<main class="rg-page"><h1 class="rg-page-title">${side} page</h1><pre class="rg-code" id="rg-code" tabindex="0">${code}</pre><div class="rg-rtl" dir="rtl" id="rg-rtl"><p class="rg-track">${side} right to left</p></div><div class="rg-grid" id="rg-grid"><p class="rg-grid-content">${side} grid</p></div>${blocks}</main>`;
}

const tasks = (side: Side) => `---
title: Tasks
element: ui-tasks
propSchema: {type: object, additionalProperties: false, properties: {label: {type: string}}}
props: {label: Task 13}
variants: [{slug: list, title: List, props: {label: ${side} task}}]
---
<ul aria-label="Tasks" class="rg-tasks">${times(20, (row) => `<li class="rg-task">${row === 3 ? "{{label}}" : `Task ${row + 10}`}</li>`)}</ul>`;

/** Write the scroll groups' sources for one commit. */
export async function writeScrollGroups(root: string, side: Side) {
  await write(root, "alignment.css", ALIGNMENT_CSS);
  await write(root, "regions.css", REGIONS_CSS);
  await write(root, "alignment-late.svg", LATE_IMAGE);
  await write(
    root,
    "specs/screens/tall.screen.html",
    screen("Tall screen", tall(side)),
  );
  await write(
    root,
    "specs/screens/app-shell.screen.html",
    screen(
      "App shell screen",
      `<main class="al-inner" id="al-inner"><p class="al-inner-content">${side} inner region</p></main>`,
    ),
  );
  await write(
    root,
    "specs/screens/regions.screen.html",
    screen("Regions shell", regionsShell(side)),
  );
  await write(
    root,
    "specs/screens/regions-page.screen.html",
    screen("Regions page", regionsPage(side)),
  );
  await write(root, "specs/components/tasks.component.html", tasks(side));
}
