import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { discoverEntryModules } from "../dist/config/entry_discovery.js";
import { loadConfig } from "../dist/config/load.js";
import { resolveConfig } from "../dist/config/validate.js";

import {
  createFixture,
  removeFixture,
  type TestFixture,
} from "./helpers/fixture.js";

const screen = (id: string, route: string) =>
  `import { defineScreen } from "@mokly/mokly";
const metadata = { dependencies: ["notes.md"], relatedDocs: ["notes.md"], useCaseIds: [] };
export const mockups = [defineScreen({ ...metadata, description: ${JSON.stringify(id)}, desktop: ${JSON.stringify(id)}, id: ${JSON.stringify(id)}, mobile: ${JSON.stringify(id)}, route: ${JSON.stringify(route)}, title: ${JSON.stringify(id)} })];
`;

async function writeConfig(fixture: TestFixture, body: string): Promise<void> {
  await fs.promises.writeFile(
    fixture.configPath,
    `export default { ${body}, mockupsDir: "mockups", repoRoot: ".", review: { outDir: ".review" } };\n`,
  );
}

async function addModule(
  fixture: TestFixture,
  relative: string,
  contents: string,
): Promise<string> {
  const target = path.join(fixture.root, relative);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, contents);
  return target;
}

test("entriesDir is shorthand for one glob and resolves the same modules", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const shorthand = await loadConfig(fixture.root);
  assert.deepEqual(shorthand.entryGlobs, ["entries/**/*.mockup.{ts,tsx}"]);
  assert.equal(shorthand.entriesDir, fixture.entriesDir);
  await writeConfig(fixture, 'entries: ["entries/**/*.mockup.{ts,tsx}"]');
  const explicit = await loadConfig(fixture.root);
  assert.deepEqual(explicit.entryGlobs, shorthand.entryGlobs);
  assert.equal(explicit.entriesDir, undefined);
  assert.deepEqual(
    discoverEntryModules(explicit),
    discoverEntryModules(shorthand),
  );
  const first = (await compileCatalogue(shorthand)).manifest;
  const second = (await compileCatalogue(explicit)).manifest;
  assert.deepEqual(second, first);
});

test("config requires exactly one of entries and entriesDir", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  for (const [label, input] of [
    ["both", { entries: ["entries/**"], entriesDir: "entries" }],
    ["neither", {}],
    ["empty", { entries: [] }],
    ["duplicate", { entries: ["entries/**", "entries/**"] }],
    ["escaping", { entries: ["../outside/**"] }],
    ["absolute", { entries: ["/entries/**"] }],
    ["cache", { entries: [".mokly-cache/**/*.mockup.tsx"] }],
    ["non-string", { entries: [1] }],
  ] as const) {
    assert.throws(
      () =>
        resolveConfig({ ...input, mockupsDir: "mockups" }, fixture.configPath),
      { code: "config-invalid" },
      label,
    );
  }
});

test("a glob makes every matched file an entry module", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const helper = await addModule(
    fixture,
    "src/helper.ts",
    "export const value = 1;\n",
  );
  await writeConfig(fixture, 'entries: ["src/**/*.ts"]');
  const config = await loadConfig(fixture.root);
  assert.deepEqual(config.entryModules, [helper]);
  await assert.rejects(compileCatalogue(config), {
    code: "build-invalid",
    message: /\[empty-registry\].*no registry definitions were exported/s,
  });
});

test("a glob matching no module is a config error", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await writeConfig(fixture, 'entries: ["src/**/*.ts"]');
  await assert.rejects(loadConfig(fixture.root), {
    code: "config-invalid",
    message: /entries glob matches no module: src\/\*\*\/\*\.ts/,
  });
});

test("a resolved config carries its entry set and compilation refreshes it", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.deepEqual(config.entryModules, [fixture.entryPath]);
  const created = await addModule(
    fixture,
    "entries/second.mockup.tsx",
    screen("second", "screens/second.html"),
  );
  const graph = await loadConsumerGraph(config);
  assert.deepEqual(graph.entrySources, [fixture.entryPath, created]);
  assert.deepEqual(config.entryModules, [fixture.entryPath]);
});

test("config loading rejects review output below a resolved entry directory", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await addModule(
    fixture,
    "src/components/button/button.mockup.tsx",
    screen("button", "components/button.html"),
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `export default {
  entries: ["src/**/*.mockup.{ts,tsx}"],
  mockupsDir: "mockups",
  repoRoot: ".",
  review: { outDir: "src/components/button/.review" }
};\n`,
  );

  await assert.rejects(loadConfig(fixture.root), {
    code: "config-invalid",
    message:
      /review\.outDir must not overlap repository, mockup, source, or cache roots/,
  });
});

test("discovery unions globs, ignores order, and sorts by repository path", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await addModule(
    fixture,
    "src/widgets/zeta/zeta.mockup.tsx",
    screen("zeta", "widgets/zeta.html"),
  );
  await addModule(
    fixture,
    "src/widgets/alpha/alpha.mockup.ts",
    screen("alpha", "widgets/alpha.html"),
  );
  await addModule(fixture, "src/widgets/alpha/alpha.tsx", "export {};\n");
  const expected = [
    path.join(fixture.root, "entries/fixture.mockup.tsx"),
    path.join(fixture.root, "src/widgets/alpha/alpha.mockup.ts"),
    path.join(fixture.root, "src/widgets/zeta/zeta.mockup.tsx"),
  ];
  for (const globs of [
    '["entries/**/*.mockup.{ts,tsx}", "src/**/*.mockup.{ts,tsx}"]',
    '["src/**/*.mockup.{ts,tsx}", "entries/**/*.mockup.{ts,tsx}"]',
    '["src/widgets/zeta/*.mockup.tsx", "src/widgets/alpha/*.mockup.{ts,tsx}", "entries/**"]',
  ]) {
    await writeConfig(fixture, `entries: ${globs}`);
    const config = await loadConfig(fixture.root);
    assert.deepEqual(discoverEntryModules(config), expected, globs);
    const graph = await loadConsumerGraph(config);
    assert.deepEqual(graph.entrySources, expected);
    const manifest = (await compileCatalogue(config)).manifest;
    assert.equal(
      manifest.entries.find((entry) => entry.id === "alpha")?.sourcePath,
      "src/widgets/alpha/alpha.mockup.ts",
    );
    assert.ok(
      manifest.sourceFiles.includes("src/widgets/zeta/zeta.mockup.tsx"),
    );
  }
});

test("discovery rejects entry modules inside private, output, and review trees", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await addModule(fixture, ".mokly-cache/x.mockup.tsx", screen("x", "x.html"));
  await writeConfig(
    fixture,
    'entries: ["entries/**/*.mockup.{ts,tsx}", ".mokly-cache/x.mockup.tsx"]',
  );
  await assert.rejects(loadConfig(fixture.root), {
    code: "config-invalid",
    message:
      /entries glob must stay inside repoRoot and outside \.mokly-cache: \.mokly-cache\/x\.mockup\.tsx/,
  });
  await fs.promises.rm(path.join(fixture.root, ".mokly-cache"), {
    force: true,
    recursive: true,
  });
  for (const [relative, glob, reason] of [
    [
      "src/node_modules/pkg/x.mockup.tsx",
      "src/**/*.mockup.{ts,tsx}",
      /denied source directory \(node_modules\)/,
    ],
    [".review/x.mockup.tsx", ".review/x.mockup.tsx", /inside review\.outDir/],
  ] as const) {
    await addModule(fixture, relative, screen("x", "x.html"));
    await writeConfig(
      fixture,
      `entries: ["entries/**/*.mockup.{ts,tsx}", ${JSON.stringify(glob)}]`,
    );
    await assert.rejects(
      async () => discoverEntryModules(await loadConfig(fixture.root)),
      { code: "config-invalid", message: reason },
      relative,
    );
    await fs.promises.rm(path.join(fixture.root, relative.split("/")[0]!), {
      force: true,
      recursive: true,
    });
  }
});

test("discovery rejects an entry module that escapes repoRoot through a symlink", async (t) => {
  const fixture = await createFixture();
  const outside = await createFixture();
  t.after(() => removeFixture(fixture));
  t.after(() => removeFixture(outside));
  await fs.promises.symlink(
    path.join(outside.root, "entries"),
    path.join(fixture.root, "linked"),
  );
  await writeConfig(
    fixture,
    'entries: ["entries/**/*.mockup.{ts,tsx}", "linked/**/*.mockup.{ts,tsx}"]',
  );
  await assert.rejects(
    async () => discoverEntryModules(await loadConfig(fixture.root)),
    { code: "config-invalid", message: /resolves outside repoRoot/ },
  );
});

test("a glob may reach nested entries beside output while the output root stays private", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const nested = path.join(fixture.mockupsDir, "src/entries");
  await fs.promises.mkdir(nested, { recursive: true });
  await fs.promises.rename(
    fixture.entryPath,
    path.join(nested, "fixture.mockup.tsx"),
  );
  await writeConfig(fixture, 'entries: ["mockups/src/**/*.mockup.{ts,tsx}"]');
  const config = await loadConfig(fixture.root);
  assert.deepEqual(discoverEntryModules(config), [
    path.join(nested, "fixture.mockup.tsx"),
  ]);
  const compilation = await compileCatalogue(config);
  assert.equal(
    compilation.manifest.entries[0]?.sourcePath.startsWith("mockups/src/"),
    true,
  );
});
