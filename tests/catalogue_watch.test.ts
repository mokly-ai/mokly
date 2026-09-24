import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";
import { readCatalogue } from "../packages/viewer/dist/catalogue/reader.js";
import type { CatalogueReadModel } from "../packages/viewer/dist/catalogue/types.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { createExportFixture } from "./helpers/export_fixture.js";
import { version, waitForUpdate } from "./helpers/watched_catalogue.js";

test(
  "watched PostCSS dependency directories rebuild on a new matching file",
  { timeout: 60_000 },
  async (t) => {
    const fixture = await changedFixture(
      t,
      undefined,
      {
        extraConfig: 'postcss: "postcss.config.mjs", watch: { debounceMs: 0 },',
      },
      async (candidate) => {
        await fs.mkdir(path.join(candidate.root, "sources"));
        await fs.writeFile(
          path.join(candidate.entriesDir, "fixture.css"),
          ".entry{color:red}",
        );
        await fs.appendFile(candidate.entryPath, '\nimport "./fixture.css";');
        await fs.writeFile(
          path.join(candidate.root, "postcss.config.mjs"),
          `import fs from "node:fs";
           import path from "node:path";
           const directory = path.join(import.meta.dirname, "sources");
           export default { plugins: [{ postcssPlugin: "watch-dir", Once(root, { result }) {
             result.messages.push({ type: "dir-dependency", plugin: "watch-dir", dir: directory, glob: "*.txt" });
             for (const file of fs.readdirSync(directory))
               if (file.endsWith(".txt")) root.append({ selector: ".added", nodes: [{ prop: "color", value: fs.readFileSync(path.join(directory, file), "utf8").trim() }] });
           } }] };`,
        );
      },
    );
    const running = await serve(fixture.config, { port: 0, watch: true });
    fixture.beforeRemove(() => running.close());
    const initial = await fetch(running.url).then((response) =>
      response.text(),
    );
    const stylesheet = `${running.url}/static/mokly-generated/styles/entries/fixture.mockup.tsx.css`;
    assert.doesNotMatch(
      await fetch(stylesheet).then((response) => response.text()),
      /\.added/,
    );
    await fs.writeFile(path.join(fixture.root, "sources/new.txt"), "blue");
    await waitForUpdate(running.url, version(initial));
    let changed = "";
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      try {
        changed = await fetch(stylesheet).then((response) => response.text());
      } catch (error) {
        const code = (error as { cause?: NodeJS.ErrnoException }).cause?.code;
        if (code !== "ECONNREFUSED" && code !== "ECONNRESET") throw error;
      }
      if (/\.added/.test(changed)) break;
      await setTimeout(80);
    }
    assert.match(changed, /\.added/);
  },
);

test(
  "watched PostCSS module and reported file edits refresh the accepted CSS",
  { timeout: 60_000 },
  async (t) => {
    const fixture = await changedFixture(
      t,
      undefined,
      {
        extraConfig: 'postcss: "postcss.config.mjs", watch: { debounceMs: 0 },',
      },
      async (candidate) => {
        await fs.mkdir(path.join(candidate.root, "sources"));
        await fs.writeFile(
          path.join(candidate.root, "sources/color.txt"),
          "red",
        );
        await fs.writeFile(
          path.join(candidate.entriesDir, "fixture.css"),
          ".entry{color:red}",
        );
        await fs.appendFile(candidate.entryPath, '\nimport "./fixture.css";');
        await fs.writeFile(
          path.join(candidate.root, "postcss.config.mjs"),
          postcssWatchPlugin("margin"),
        );
      },
    );
    const running = await serve(fixture.config, { port: 0, watch: true });
    fixture.beforeRemove(() => running.close());
    const stylesheet = `${running.url}/static/mokly-generated/styles/entries/fixture.mockup.tsx.css`;
    const waitForStyle = async (pattern: RegExp): Promise<void> => {
      const deadline = Date.now() + 20_000;
      let css = "";
      while (Date.now() < deadline) {
        try {
          css = await fetch(stylesheet).then((response) => response.text());
        } catch (error) {
          const code = (error as { cause?: NodeJS.ErrnoException }).cause?.code;
          if (code !== "ECONNREFUSED" && code !== "ECONNRESET") throw error;
        }
        if (pattern.test(css)) return;
        await setTimeout(80);
      }
      assert.match(css, pattern);
    };
    await waitForStyle(/margin: red/);
    await fs.writeFile(path.join(fixture.root, "sources/color.txt"), "blue");
    await waitForStyle(/margin: blue/);
    await fs.writeFile(
      path.join(fixture.root, "postcss.config.mjs"),
      postcssWatchPlugin("padding"),
    );
    await waitForStyle(/padding: blue/);
  },
);

function postcssWatchPlugin(property: string): string {
  return `import fs from "node:fs";
    const file = new URL("./sources/color.txt", import.meta.url).pathname;
    export default { plugins: [{ postcssPlugin: "watch-file", Once(root, { result }) {
      result.messages.push({ type: "dependency", plugin: "watch-file", file });
      root.walkRules(rule => rule.append({ prop: ${JSON.stringify(property)}, value: fs.readFileSync(file, "utf8").trim() }));
    } }] };`;
}

test(
  "watched content and background evidence publish coherent catalogue revisions",
  { timeout: 30_000 },
  async (t) => {
    const source = componentEntrySource();
    const fixture = await createExportFixture(source);
    const startup = serve(fixture.config, { port: 0, watch: true });
    t.after(async () => {
      const running = await startup.catch(() => undefined);
      await running?.close();
      await fixture.close();
    });
    const running = await startup;
    const initial = await waitForCatalogue(
      running.url,
      (model) => model.changesStatus === "ready",
    );
    assert.equal(initial.comparisonUrl, null);
    const home = initial.screens.find((screen) => screen.id === "home")!;
    assert.ok(home.views.every((view) => view.usage.status === "ready"));
    const nextSource = source.replaceAll('label="Finish"', 'label="Updated"');
    await fs.writeFile(fixture.entryPath, nextSource);
    const updated = await waitForCatalogue(
      running.url,
      (model) =>
        model.changesStatus === "ready" &&
        model.revision.content > initial.revision.content,
    );
    assert.ok(updated.revision.evidence > initial.revision.evidence);
    assert.notEqual(updated.deploymentId, initial.deploymentId);
    assert.deepEqual(
      updated.screens.find((screen) => screen.id === "home")!.changes,
      {
        status: "ready",
        kind: "changed",
        included: true,
      },
    );
    assert.equal(updated.comparisonUrl, null);
    await fs.writeFile(
      fixture.entryPath,
      nextSource.replace('title: "Home"', 'title: "Updated Home"'),
    );
    const replacement = await waitForCatalogue(
      running.url,
      (model) =>
        model.changesStatus === "ready" &&
        model.screens.some((screen) => screen.title === "Updated Home") &&
        model.revision.content > updated.revision.content,
    );
    assert.equal(replacement.identity.id, initial.identity.id);
    assert.notEqual(replacement.deploymentId, updated.deploymentId);
  },
);

test(
  "watched serve discovers a new entry beneath a configured glob root",
  { timeout: 30_000 },
  async (t) => {
    const fixture = await createExportFixture();
    await fs.writeFile(
      fixture.configPath,
      `export default {
  generatedOutput: "committed",
  entries: ["**/*.mockup.{ts,tsx}"],
  mockupsDir: "mockups",
  repoRoot: ".",
  review: { outDir: ".review", sharedImpact: ["notes.md"] },
  watch: { debounceMs: 0 }
};\n`,
    );
    const config = await loadConfig(fixture.root);
    const startup = serve(config, { port: 0, watch: true });
    t.after(async () => {
      const running = await startup.catch(() => undefined);
      await running?.close();
      await fixture.close();
    });
    const running = await startup;
    const initial = await waitForCatalogue(running.url, () => true);
    const created = path.join(
      fixture.root,
      "src/components/card/card.mockup.tsx",
    );
    await fs.mkdir(path.dirname(created), { recursive: true });
    await fs.writeFile(
      created,
      `import { defineScreen } from "@mokly/mokly";
export const mockups = [defineScreen({
  dependencies: [],
  description: "Newly discovered card",
  desktop: "Card",
  id: "new-card",
  mobile: "Card",
  relatedDocs: [],
  route: "screens/new-card.html",
  title: "New card",
  useCaseIds: []
})];\n`,
    );

    const updated = await waitForCatalogue(
      running.url,
      (model) =>
        model.revision.content > initial.revision.content &&
        model.screens.some((screen) => screen.id === "new-card"),
    );
    assert.ok(updated.screens.some((screen) => screen.id === "new-card"));
  },
);

async function waitForCatalogue(
  origin: string,
  accepted: (model: CatalogueReadModel) => boolean,
): Promise<CatalogueReadModel> {
  const deadline = performance.now() + 20_000;
  while (performance.now() < deadline) {
    try {
      const response = await fetch(`${origin}/__mokly/catalogue.json`);
      assert.equal(response.status, 200);
      const model = readCatalogue(await response.json());
      if (accepted(model)) return model;
    } catch (error) {
      const code = (error as { cause?: NodeJS.ErrnoException }).cause?.code;
      if (
        !code ||
        !["ECONNREFUSED", "ECONNRESET", "UND_ERR_SOCKET"].includes(code)
      )
        throw error;
    }
    await setTimeout(30);
  }
  throw new Error("Watched catalogue did not reach the expected revision");
}
