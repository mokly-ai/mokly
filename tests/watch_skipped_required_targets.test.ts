import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../packages/mokly/dist/config/load.js";
import { serve } from "../packages/mokly/dist/server/serve.js";
import { watchTargets } from "../packages/mokly/dist/server/watch_paths.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { version } from "./helpers/watched_catalogue.js";
import { waitForWatchedResource } from "./helpers/watched_events.js";

for (const rootKind of ["entry", "postcss", "watch-rule"] as const)
  test(`required files under skipped folders stay explicit beneath ${rootKind} roots`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const source = path.join(fixture.root, "entries/vendor/dist/theme.css");
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(source, ".x{color:red}");
    const config = {
      ...(await loadConfig(fixture.root)),
      sourceFiles: ["entries/vendor/dist/theme.css"],
      ...(rootKind === "postcss"
        ? {
            postcssWatchDirectories: [
              {
                directory: path.join(fixture.root, "entries/vendor"),
                glob: "**/*",
              },
            ],
          }
        : rootKind === "watch-rule"
          ? {
              watch: {
                ...(await loadConfig(fixture.root)).watch,
                rules: [
                  { paths: ["entries/vendor/**"], action: "rebuild" as const },
                ],
              },
            }
          : {}),
    };
    assert.ok(watchTargets(config).includes(source));
  });

test(
  "real watcher reloads an imported entry stylesheet beneath dist",
  { timeout: 60_000 },
  async (context) => {
    const fixture = await changedFixture(
      context,
      undefined,
      { extraConfig: "watch: { debounceMs: 0 }," },
      async (candidate) => {
        const file = path.join(candidate.entriesDir, "vendor/dist/theme.css");
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, ".theme{color:red}");
        await fs.appendFile(
          candidate.entryPath,
          '\nimport "./vendor/dist/theme.css";',
        );
      },
    );
    const running = await serve(fixture.config, { port: 0, watch: true });
    fixture.beforeRemove(() => running.close());
    const before = version(
      await fetch(running.url).then((response) => response.text()),
    );
    const stylesheet = `${running.url}/static/mokly-generated/styles/entries/fixture.mockup.tsx.css`;
    const css = await waitForWatchedResource({
      origin: running.url,
      previous: before,
      resource: stylesheet,
      edit: () =>
        fs.writeFile(
          path.join(fixture.entriesDir, "vendor/dist/theme.css"),
          ".theme{color:blue}",
        ),
      read: (response) => response.text(),
      accept: (value) => /color: blue/.test(value),
    });
    assert.match(css, /color: blue/);
  },
);

test(
  "real watcher picks up a newly reported PostCSS file beneath dist",
  { timeout: 90_000 },
  async (context) => {
    const fixture = await changedFixture(
      context,
      undefined,
      {
        extraConfig: 'postcss: "postcss.config.mjs", watch: { debounceMs: 0 },',
      },
      async (candidate) => {
        await fs.mkdir(path.join(candidate.root, "sources/dist"), {
          recursive: true,
        });
        await fs.writeFile(
          path.join(candidate.entriesDir, "fixture.css"),
          ".x{color:red}",
        );
        await fs.appendFile(candidate.entryPath, '\nimport "./fixture.css";');
        await fs.writeFile(
          path.join(candidate.root, "postcss.config.mjs"),
          `import fs from "node:fs";
         import path from "node:path";
         const sources = path.join(import.meta.dirname, "sources");
         const token = path.join(sources, "dist/tokens.txt");
         export default { plugins: [{ postcssPlugin: "dist-token", Once(root, { result }) {
           result.messages.push({ type: "dir-dependency", plugin: "dist-token", dir: sources, glob: "*.txt" });
           if (fs.existsSync(token)) {
             result.messages.push({ type: "dependency", plugin: "dist-token", file: token });
             root.append({ selector: ".token", nodes: [{ prop: "color", value: fs.readFileSync(token, "utf8").trim() }] });
           }
         } }] };`,
        );
      },
    );
    const running = await serve(fixture.config, { port: 0, watch: true });
    fixture.beforeRemove(() => running.close());
    const token = path.join(fixture.root, "sources/dist/tokens.txt");
    await fs.writeFile(token, "blue");
    let previous = version(
      await fetch(running.url).then((response) => response.text()),
    );
    const stylesheet = `${running.url}/static/mokly-generated/styles/entries/fixture.mockup.tsx.css`;
    await waitForWatchedResource({
      origin: running.url,
      previous,
      resource: stylesheet,
      edit: () =>
        fs.writeFile(
          path.join(fixture.entriesDir, "fixture.css"),
          ".x{color:green}",
        ),
      read: (response) => response.text(),
      accept: (value) => /color: blue/.test(value),
    });
    previous = version(
      await fetch(running.url).then((response) => response.text()),
    );
    const css = await waitForWatchedResource({
      origin: running.url,
      previous,
      resource: stylesheet,
      edit: () => fs.writeFile(token, "purple"),
      read: (response) => response.text(),
      accept: (value) => /color: purple/.test(value),
    });
    assert.match(css, /color: purple/);
  },
);
