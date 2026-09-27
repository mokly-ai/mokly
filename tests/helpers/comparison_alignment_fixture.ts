/**
 * A Git-backed Serve catalogue whose comparisons are taller than their chrome:
 * a viewport-height hero with a sticky header, a fixed bar, an anchor, an
 * input and a late image; a Before document taller than its Current pair; a
 * document that scrolls only inside an inner region; and a saved component
 * variant taller than its bordered frame. It is dedicated to the comparison
 * pane alignment specs, so the shared comparison fixtures keep their counts.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { serve } from "../../dist/server/serve.js";

import { createFixture, removeFixture } from "./fixture.js";
import { waitForClassifiedCount } from "./watched_catalogue.js";

/** Changed screens and variants the classified catalogue reports. */
export const ALIGNMENT_CHANGED_COUNT = 4;

/** Height in CSS pixels of every block below the tall screen's hero. */
export const ALIGNMENT_BLOCK_HEIGHT = 300;

/** The late image's rendered height once it loads (a 10×120 SVG at 100px). */
export const ALIGNMENT_LATE_IMAGE_HEIGHT = 1200;

/** Document heights of the short screen's Before and Current versions. */
export const ALIGNMENT_SHORT_HEIGHTS = { before: 2400, after: 1000 } as const;

/** The canvas colour of the short screen's Current document. */
export const ALIGNMENT_SHORT_CANVAS = "rgb(200, 220, 255)";

const STYLES = `body { margin: 0; font: 16px/1.5 sans-serif; background: rgb(250, 250, 250); }
.al-header { position: sticky; top: 0; z-index: 1; height: 48px; margin: 0; background: rgb(221, 238, 255); }
.al-hero { min-height: 100vh; margin: 0; padding: 16px; background: rgb(255, 238, 221); }
.al-block { height: ${ALIGNMENT_BLOCK_HEIGHT}px; margin: 0; padding: 16px; }
.al-target { height: ${ALIGNMENT_BLOCK_HEIGHT}px; margin: 0; background: rgb(221, 255, 221); }
.al-late { display: block; width: 100px; }
.al-bar { position: fixed; left: 0; right: 0; bottom: 0; height: 40px; margin: 0; background: rgb(34, 51, 68); color: white; }
.al-short { margin: 0; }
.al-short-block { height: 100px; margin: 0; }
body:has(.al-short-after) { background: ${ALIGNMENT_SHORT_CANVAS}; }
html:has(.al-inner), body:has(.al-inner) { height: 100%; overflow: hidden; }
.al-inner { height: 100vh; overflow: auto; margin: 0; }
.al-inner-content { height: 2000px; margin: 0; }
.al-list { margin: 0; padding: 0; list-style: none; }
.al-row { height: 60px; margin: 0; }
`;

const LATE_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="120"><rect width="10" height="120" fill="rgb(120, 140, 160)"/></svg>\n';

function blocks(changed: boolean): string {
  return Array.from(
    { length: 6 },
    (_, index) =>
      `<section className="al-block" id="al-block-${index + 1}">${
        index === 2 && changed ? "Current" : "Previous"
      } block ${index + 1}</section>`,
  ).join("");
}

function tallScreen(changed: boolean): string {
  const version = changed ? "Current" : "Previous";
  return `<main className="al-page"><header className="al-header">Alignment header</header><section className="al-hero"><h1>${version} tall</h1><p><a id="al-jump" href="#al-target">Jump to target</a> <a id="al-away" href="mock:short">Open short</a></p><p><input id="al-field" aria-label="Note" /></p></section>${blocks(changed)}<section className="al-target" id="al-target">Target section</section><img className="al-late" id="al-late" src="../alignment-late.svg" alt="" /><footer className="al-bar">Fixed bar</footer></main>`;
}

function shortScreen(changed: boolean): string {
  const height = changed
    ? ALIGNMENT_SHORT_HEIGHTS.after
    : ALIGNMENT_SHORT_HEIGHTS.before;
  const rows = Array.from(
    { length: height / 100 },
    (_, index) =>
      `<p className="al-short-block" id="al-short-${index}">${changed ? "Current" : "Previous"} row ${index}</p>`,
  ).join("");
  return `<main className="al-short ${changed ? "al-short-after" : "al-short-before"}">${rows}</main>`;
}

function innerScreen(changed: boolean): string {
  return `<main className="al-inner" id="al-inner"><p className="al-inner-content">${changed ? "Current" : "Previous"} inner region</p></main>`;
}

/** Authored entries for the alignment catalogue before and after the change. */
export function comparisonAlignmentSource(changed: boolean): string {
  const screen = (id: string, title: string, body: string) =>
    `defineScreen({ ...metadata, id: "${id}", title: "${title}", route: "screens/${id}.html", description: "${title} screen", useCaseIds: [], mobile: ${body}, desktop: ${body} })`;
  return `import { defineCollection, defineComponent, defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { dependencies: ["notes.md"], relatedDocs: ["notes.md"] };
const rows = Array.from({ length: 20 }, (_, index) => index);
const checklist = defineComponent({ ...metadata,
  id: "checklist", title: "Checklist", description: "A list taller than its frame", route: "components/checklist.html",
  propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } } } },
  render: (props) => <ol className="al-list">{rows.map((row) => <li className="al-row" id={"al-row-" + row} key={row}>{row === 7 ? props.label : "Row " + row}</li>)}</ol>,
  variants: [{ id: "long", title: "Long", props: { label: "${changed ? "Current" : "Previous"} row" } }]
});
export const mockups = [
  defineCollection({ ...metadata, childIds: ["tall", "short", "inner", "checklist"], description: "Alignment fixtures", id: "alignment", title: "Alignment" }),
  ${screen("tall", "Tall", tallScreen(changed))},
  ${screen("short", "Short", shortScreen(changed))},
  ${screen("inner", "Inner", innerScreen(changed))},
  checklist.entry
];`;
}

/** Serve the alignment catalogue against a real Git baseline. */
export async function comparisonAlignmentFixture() {
  const fixture = await createFixture(comparisonAlignmentSource(false), {
    extraConfig:
      'stylesheets: [{ match: "**/*.html", stylesheets: ["alignment.css"] }],',
  });
  try {
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "alignment.css"),
      STYLES,
    );
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "alignment-late.svg"),
      LATE_IMAGE,
    );
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    git("add", ".");
    git("commit", "-qm", "test: alignment baseline");
    await fs.promises.writeFile(
      fixture.entryPath,
      comparisonAlignmentSource(true),
    );
    const running = await serve(config, {
      base: "HEAD",
      port: 0,
      watch: false,
    });
    try {
      await waitForClassifiedCount(running.url, ALIGNMENT_CHANGED_COUNT);
    } catch (error) {
      await running.close();
      throw error;
    }
    return {
      url: running.url,
      async close() {
        await running.close();
        await removeFixture(fixture);
      },
    };
  } catch (error) {
    await removeFixture(fixture);
    throw error;
  }
}
