import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { GitTrackedGeneratedOutput } from "../dist/build/tracked_output.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

test("derived Check gives one directory ignore rule for tracked reserved routes", async (context) => {
  const fixture = await styleFixture(".entry{color:red}");
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compiled = await compileCatalogue(config);
  const route = "mockups/mokly-generated/styles/entries/fixture.mockup.tsx.css";
  const tracked = new GitTrackedGeneratedOutput({
    async run(args: readonly string[]) {
      if (args[0] === "rev-parse") return fixture.root;
      if (args[0] === "ls-files") return `${route}\0`;
      if (args[0] === "grep") return "";
      throw new Error(`unexpected git command: ${args[0]}`);
    },
  });
  await assert.rejects(
    () => tracked.check(compiled, config),
    (error: Error) => {
      assert.equal(
        error.message,
        `[mokly/build-invalid] derived output must not be tracked by Git:\n  - ${route}\nRemove these paths from the index with git rm --cached and add these rules to .gitignore:\n/mockups/mokly-generated/\n/.mokly-cache/`,
      );
      return true;
    },
  );
});

test("CSS Modules reject class maps changed by renderer pruning after inlining", async (context) => {
  const fixture = await styleFixture(
    '@import "./shared.css"; .card{color:red}',
    {
      module: true,
      extraConfig: 'renderer: "renderer.tsx", postcss: "postcss.config.mjs",',
    },
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "shared.css"),
    ".shared{color:blue}",
  );
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    'import "./entries/shared.css"; export default () => "<!doctype html><html><head></head><body>fixture</body></html>";',
  );
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `export default { plugins: [{ postcssPlugin: "inline-shared", Once(root, { result }) {
      if (!result.opts.from.endsWith("fixture.module.css")) return;
      root.walkAtRules("import", rule => {
        rule.before({ selector: ".shared", nodes: [{ prop: "color", value: "blue" }] });
        rule.remove();
      });
    } }] };`,
  );
  await assert.rejects(
    compileFixture(fixture),
    /\[mokly\/build-invalid\] CSS Modules exports differ after renderer pruning in entries\/fixture.module.css; avoid inlining shared imports in modules or use Tailwind @reference/,
  );
});

test("authored public CSS rejects image-set string URLs", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'stylesheets: [{ match: "**", stylesheets: ["public.css"] }],',
  });
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "public.css"),
    '.hero{background:image-set("./picture.png" 1x)}',
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /image-set\(\) string URL is unsupported in mockups\/public.css: \.\/picture.png; wrap the URL in url\(\)/,
  );
});

test("scoped npm renderer imports a delivered stylesheet", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'renderer: "node_modules/@acme/renderer/index.tsx",',
  });
  context.after(() => removeFixture(fixture));
  const directory = path.join(fixture.root, "node_modules/@acme/renderer");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "index.tsx"),
    'import "./theme.css"; export default ({node, stylesheets}) => `<!doctype html><html><head>${stylesheets.map((href) => `<link rel="stylesheet" href="${href}">`).join("")}</head><body>fixture</body></html>`;',
  );
  await fs.writeFile(
    path.join(directory, "theme.css"),
    ".package{color:purple}",
  );
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  const route =
    "mokly-generated/styles/node_modules/@acme/renderer/index.tsx.css";
  assert.match(compiled.outputs.get(route) as string, /\.package/);
  assert.ok(
    [...compiled.outputs.values()].some(
      (value) =>
        typeof value === "string" &&
        value.includes("%40acme/renderer/index.tsx.css"),
    ),
  );
});
