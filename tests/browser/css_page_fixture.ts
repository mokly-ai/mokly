import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { serve } from "../../dist/server/serve.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";
import { waitForClassifiedCount } from "../helpers/watched_catalogue.js";

/**
 * Action's own pages match `.action`. The handbook, named like the approved
 * design's document, links two sheets and holds its own `.action` element; the
 * notes document links a third sheet.
 */
const SOURCE = `import React from "react";
import { defineComponent, definePage } from "@mokly/mokly";
const metadata = { relatedDocs: [], navPath: ["Fixture"] };
const action = defineComponent({ ...metadata, id: "action", title: "Action", description: "Action",
  propSchema: { kind: "object", properties: {} }, render: () => <button className="action">Continue</button>,
  variants: [{ id: "action-default", title: "Default", props: {} }] });
const documentPage = (id, title, sheets, body) => definePage({ ...metadata, id, title, description: title,
  render: () => '<!doctype html><html><head><title>' + title + '</title>' +
    sheets.map((href) => '<link rel="stylesheet" href="../' + href + '">').join('') +
    '</head><body>' + body + '</body></html>' });
export const mockups = [action.entries,
  documentPage("example-handbook", "Getting started", ["actions.css", "handbook.css"],
    '<article><h1>Getting started</h1><h2>Next steps</h2><p><span class="action">Open</span></p></article>'),
  documentPage("notes", "Notes", ["notes.css"], "<main><h1>Notes</h1></main>")];
`;

/** Every component document links the configured stylesheets. */
const RENDERER = `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<!doctype html><html><head>' + input.stylesheets.map((href) => '<link rel="stylesheet" href="' + href + '">').join('') + '</head><body>' + renderToStaticMarkup(input.node) + '</body></html>';
`;

const BASELINE_CSS = ".unrelated { color: black; }\n";

/**
 * The approved document story after the baseline commit: `.action` changes
 * Action and also styles the handbook, the handbook's own sheet gains a heading
 * rule and a rule that can apply anywhere, and the notes sheet gains a rule
 * that matches nothing on its page.
 */
const PAGE_STYLE_EDITS: Readonly<Record<string, string>> = {
  "actions.css": ".action { color: blue; }\n",
  "handbook.css": "article h2 { color: blue; }\n:root { --tone: red; }\n",
  "notes.css": ".missing { color: red; }\n",
};

/** Serve a Git-backed catalogue whose documents link changed stylesheets. */
export async function cssPageFixture() {
  const fixture = await createFixture(SOURCE, {
    extraConfig:
      'renderer: "renderer.tsx", stylesheets: [{ match: "**/*.html", stylesheets: ["actions.css"] }],',
  });
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), RENDERER);
  for (const name of Object.keys(PAGE_STYLE_EDITS))
    await fs.writeFile(path.join(fixture.mockupsDir, name), BASELINE_CSS);
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  git("add", ".");
  git("commit", "-qm", "test: catalogue baseline");
  for (const [name, css] of Object.entries(PAGE_STYLE_EDITS))
    await fs.appendFile(path.join(fixture.mockupsDir, name), css);
  await writeCompilation(await compileCatalogue(config), config);
  const running = await serve(config, { base: "main", port: 0, watch: false });
  try {
    await waitForClassifiedCount(running.url, 3);
  } catch (error) {
    await running.close();
    await removeFixture(fixture);
    throw error;
  }
  return {
    url: running.url,
    async close() {
      await running.close();
      await removeFixture(fixture);
    },
  };
}
