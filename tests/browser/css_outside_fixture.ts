import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { serve } from "../../dist/server/serve.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";
import { waitForClassifiedCount } from "../helpers/watched_catalogue.js";

/** Checkout's own heading sits outside Toolbar, which renders Action. */
const SOURCE = `import React from "react";
import { defineComponent, defineScreen } from "@mokly/mokly";
const metadata = { relatedDocs: [] };
const action = defineComponent({ ...metadata, path: "action", title: "Action", description: "Action",
  propSchema: { kind: "object", properties: {} }, render: () => <button className="action">Continue</button>,
  variants: [{ slug: "default", title: "Default", props: {} }] });
const toolbar = defineComponent({ ...metadata, path: "toolbar", title: "Toolbar", description: "Toolbar",
  propSchema: { kind: "object", properties: {} }, render: () => <div className="toolbar"><action.Component /></div>,
  variants: [{ slug: "default", title: "Default", props: {} }] });
export const mockups = [...action.entries, ...toolbar.entries,
  defineScreen({ ...metadata, path: "checkout", title: "Checkout", description: "Checkout",
    mobile: <main className="checkout"><h1 className="heading">Checkout</h1><toolbar.Component /></main>,
    desktop: <main className="checkout"><h1 className="heading">Checkout</h1><toolbar.Component /></main> })];
`;

/** Every document sits in a wrapper outside each component's own output. */
const RENDERER = `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<!doctype html><html><head>' + input.stylesheets.map((href) => '<link rel="stylesheet" href="' + href + '">').join('') + '</head><body><div class="frame">' + renderToStaticMarkup(input.node) + '</div></body></html>';
`;

const BASELINE_CSS = ".unrelated { color: black; }\n";

/** How the changed stylesheet reaches every document. */
export type OutsideDelivery = "configured" | "javascript";

/**
 * Serve a Git-backed component catalogue whose one stylesheet gained `css`
 * after the baseline commit, once `changed` entries are classified.
 */
export async function cssOutsideFixture(options: {
  css: string;
  changed: number;
  delivery?: OutsideDelivery;
}) {
  const delivery = options.delivery ?? "configured";
  const fixture = await createFixture(
    delivery === "javascript" ? `import "./rule.css";\n${SOURCE}` : SOURCE,
    {
      extraConfig:
        'renderer: "renderer.tsx", ' +
        (delivery === "configured"
          ? 'stylesheets: [{ match: "**/*.html", stylesheets: ["rule.css"] }],'
          : "stylesheets: [],"),
    },
  );
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), RENDERER);
  const stylesheet = path.join(
    delivery === "javascript" ? fixture.entriesDir : fixture.mockupsDir,
    "rule.css",
  );
  await fs.writeFile(stylesheet, BASELINE_CSS);
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  git("add", ".");
  git("commit", "-qm", "test: catalogue baseline");
  await fs.appendFile(stylesheet, options.css);
  await writeCompilation(await compileCatalogue(config), config);
  const running = await serve(config, { base: "main", port: 0, watch: false });
  try {
    await waitForClassifiedCount(running.url, options.changed);
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
