/**
 * Authored entries for the inner scroll region catalogue. `shell` is an app
 * shell whose page never scrolls while its panels do: a Projects list paired by
 * landmark and label, a main panel paired by landmark holding a horizontal
 * timeline paired by `data-mokly-scroll`, an Activity panel paired by `id` that
 * moves, a Notes panel whose class names change, a Tips panel that moves and
 * pairs by its text alone, a Queue split into two equally likely halves, a Log
 * marked `off` in Current and a Fresh panel only Current has. `page` scrolls as
 * a page around a code region, a right-to-left strip and a two-axis grid;
 * `solo` is a second app shell; and `tasks` is a component whose list scrolls.
 */

/** Changed screens and variants the classified catalogue reports. */
export const REGIONS_CHANGED_COUNT = 4;

/** Height in CSS pixels of every block inside a main panel or page. */
export const REGION_BLOCK_HEIGHT = 300;

/** Blocks in the shell's main panel; Current's panel is the shorter one. */
export const REGION_MAIN_BLOCKS = { before: 10, after: 8 } as const;

/** The stylesheet every region document links. */
export const REGION_STYLES = `body { margin: 0; font: 16px/1.5 sans-serif; background: rgb(250, 250, 250); }
html:has(.rg-shell), body:has(.rg-shell), html:has(.rg-solo), body:has(.rg-solo) { height: 100%; overflow: hidden; }
.rg-shell { display: grid; grid-template-columns: 180px minmax(0, 1fr) 220px; grid-template-rows: 48px minmax(0, 1fr) 120px; height: 100vh; }
.rg-bar { grid-column: 1 / -1; margin: 0; background: rgb(221, 238, 255); }
.rg-left { display: grid; grid-template-rows: minmax(0, 1fr) 140px; min-height: 0; }
.rg-nav, .rg-log, .rg-main, .rg-panel, .rg-queue, .rg-solo, .rg-code, .rg-grid, .rg-tasks { overflow: auto; min-height: 0; margin: 0; padding: 0; }
.rg-list, .rg-tasks { margin: 0; padding: 0; list-style: none; }
.rg-line, .rg-task { height: 40px; margin: 0; overflow: hidden; white-space: nowrap; }
.rg-intro { height: 120px; margin: 0; }
.rg-strip, .rg-rtl { height: 80px; overflow-x: auto; overflow-y: hidden; margin: 0; }
.rg-track { width: 2000px; height: 60px; margin: 0; }
.rg-block { height: ${REGION_BLOCK_HEIGHT}px; margin: 0; overflow: hidden; }
.rg-deep { height: 40px; margin: 0; }
.rg-right { display: grid; grid-template-rows: repeat(6, minmax(0, 1fr)); min-height: 0; }
.rg-s1 { grid-row: 1; } .rg-s2 { grid-row: 2; } .rg-s3 { grid-row: 3; } .rg-s4 { grid-row: 4; } .rg-s5 { grid-row: 5; } .rg-s6 { grid-row: 6; }
.rg-footer { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); min-height: 0; margin: 0; }
.rg-queue-whole { grid-column: 1 / 3; }
.rg-solo { height: 100vh; }
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

/** Ten fixed-height lines, one word each after the panel's own title word. */
function lines(title: string, words: string): string {
  return words
    .split(" ")
    .map((word) => `<p className="rg-line">${title} ${word}</p>`)
    .join("");
}

function panel(
  tag: string,
  attributes: string,
  title: string,
  words: string,
): string {
  return `<${tag} ${attributes}>${lines(title, words)}</${tag}>`;
}

function mainPanel(changed: boolean): string {
  const count = changed ? REGION_MAIN_BLOCKS.after : REGION_MAIN_BLOCKS.before;
  const blocks = Array.from({ length: count }, (_, index) => {
    const body =
      index === 4
        ? '<button id="rg-focus" type="button">Deep action</button>'
        : index === 6
          ? '<h2 className="rg-deep" id="rg-deep">Deep target</h2>'
          : `Section ${index + 10} body`;
    return `<section className="rg-block" id="rg-block-${index}">${body}</section>`;
  }).join("");
  const version = changed ? "Current" : "Previous";
  return `<main className="rg-main"><p className="rg-intro" id="rg-lead">${version} overview text <a id="rg-jump" href="#rg-deep">Jump to deep</a></p><div className="rg-strip" data-mokly-scroll="timeline" id="${changed ? "strip-current" : "strip-before"}"><p className="rg-track">${version} timeline</p></div>${blocks}</main>`;
}

function rightColumn(changed: boolean): string {
  const activity = changed
    ? panel(
        "section",
        'className="rg-panel rg-s6" id="activity"',
        "Activity",
        WORDS.activityAfter,
      )
    : panel(
        "section",
        'className="rg-panel rg-s1" id="activity"',
        "Activity",
        WORDS.activityBefore,
      );
  const notes = panel(
    "div",
    `className="rg-panel rg-s2 ${changed ? "rg-notes-new" : "rg-notes-old"}"`,
    "Notes",
    WORDS.notes,
  );
  const tips = changed
    ? panel("article", 'className="rg-panel rg-s5 rg-tips"', "Tips", WORDS.tips)
    : panel("div", 'className="rg-panel rg-s3 rg-tips"', "Tips", WORDS.tips);
  const fresh = changed
    ? panel("div", 'className="rg-panel rg-s4 rg-fresh"', "Fresh", WORDS.fresh)
    : "";
  return `<div className="rg-right">${activity}${notes}${tips}${fresh}</div>`;
}

function footer(changed: boolean): string {
  const queues = changed
    ? panel("div", 'className="rg-queue rg-queue-a"', "Queue", WORDS.queue) +
      panel("div", 'className="rg-queue rg-queue-b"', "Queue", WORDS.queue)
    : panel("div", 'className="rg-queue rg-queue-whole"', "Queue", WORDS.queue);
  return `<footer className="rg-footer">${queues}</footer>`;
}

function shellScreen(changed: boolean): string {
  const projects = Array.from(
    { length: 40 },
    (_, index) =>
      `<li className="rg-line">${changed && index === 3 ? "Project renamed" : `Project ${index + 10}`}</li>`,
  ).join("");
  const log = panel(
    "div",
    `className="rg-log"${changed ? ' data-mokly-scroll="off"' : ""}`,
    "Log",
    WORDS.log,
  );
  return `<div className="rg-shell"><header className="rg-bar">${changed ? "Current" : "Previous"} regions</header><div className="rg-left"><nav aria-label="Projects" className="rg-nav"><ul className="rg-list">${projects}</ul></nav>${log}</div>${mainPanel(changed)}${rightColumn(changed)}${footer(changed)}</div>`;
}

function pageScreen(changed: boolean): string {
  const version = changed ? "Current" : "Previous";
  const code = Array.from(
    { length: 30 },
    (_, index) =>
      `<span className="rg-code-line"${index === 25 ? ' id="rg-code-end"' : ""}>${version} line ${index + 10}</span>`,
  ).join("");
  const blocks = Array.from(
    { length: 10 },
    (_, index) =>
      `<section className="rg-block" id="rg-page-${index}">${version} page block ${index + 10}</section>`,
  ).join("");
  return `<main className="rg-page"><h1 className="rg-page-title">${version} page <a id="rg-code-jump" href="#rg-code-end">Jump to code end</a></h1><pre className="rg-code" id="rg-code" tabIndex={0}>${code}</pre><div className="rg-rtl" dir="rtl" id="rg-rtl"><p className="rg-track">${version} right to left</p></div><div className="rg-grid" id="rg-grid"><p className="rg-grid-content">${version} grid</p></div>${blocks}</main>`;
}

function soloScreen(changed: boolean): string {
  const blocks = Array.from(
    { length: 8 },
    (_, index) =>
      `<section className="rg-block">${changed ? "Current" : "Previous"} solo block ${index + 10}</section>`,
  ).join("");
  return `<main className="rg-solo" id="rg-solo">${blocks}</main>`;
}

/** Authored entries for the region catalogue before and after the change. */
export function comparisonRegionsSource(changed: boolean): string {
  const screen = (id: string, title: string, body: string) =>
    `defineScreen({ ...metadata, id: "${id}", title: "${title}", description: "${title} screen", useCaseIds: [], mobile: ${body}, desktop: ${body} })`;
  return `import { defineComponent, defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { navPath: ["Regions"], relatedDocs: ["notes.md"] };
const rows = Array.from({ length: 20 }, (_, index) => index);
const tasks = defineComponent({ ...metadata,
  id: "tasks", title: "Tasks", description: "A list that scrolls inside its box",
  propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } } } },
  render: (props) => <ul aria-label="Tasks" className="rg-tasks">{rows.map((row) => <li className="rg-task" key={row}>{row === 3 ? props.label : "Task " + (row + 10)}</li>)}</ul>,
  variants: [{ id: "tasks-list", title: "List", props: { label: "${changed ? "Current" : "Previous"} task" } }]
});
export const mockups = [
  ${screen("shell", "Shell", shellScreen(changed))},
  ${screen("page", "Page", pageScreen(changed))},
  ${screen("solo", "Solo", soloScreen(changed))},
  ...tasks.entries
];`;
}
