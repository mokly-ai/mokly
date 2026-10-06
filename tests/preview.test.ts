import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import {
  readShellBootstrapState,
  serializeShellBootstrap,
} from "../packages/viewer/dist/standalone/bootstrap.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import {
  createCommittedExampleBaseline,
  createExampleBaseline,
} from "./helpers/example_baseline.js";
import { repositoryRoot } from "./helpers/fixture.js";
import { timeFixturePhase } from "./helpers/fixture_timing.js";

test("preview build snapshots a static Browse catalogue", async (context) => {
  const contextDir = path.join(repositoryRoot, ".context");
  await fs.promises.mkdir(contextDir, { recursive: true });
  const root = await fs.promises.mkdtemp(
    path.join(contextDir, "preview-test-root-"),
  );
  context.after(() => fs.promises.rm(root, { force: true, recursive: true }));
  const config = await createCommittedExampleBaseline(root, "static-example");
  const entry = path.join(root, "examples/basic/specs/catalogue.tsx");
  const source = await fs.promises.readFile(entry, "utf8");
  const current = source.replace(
    '<Badge tone="primary">Example</Badge>',
    '<Badge tone="primary">Tree-owned example</Badge>',
  );
  assert.notEqual(current, source);
  await fs.promises.writeFile(entry, current);
  await writeCompilation(await compileCatalogue(config), config);
  const output = path.join(root, ".context/preview");
  const options = { includeChanges: true as const, base: "HEAD" };
  for (const phase of ["first-build", "repeat-build"])
    await timeFixturePhase("preview-snapshot", phase, true, () =>
      buildPreview(config, output, options),
    );

  await assertClientGraphIsComplete(output);
  const index = await read(output, "index.html");
  assert.match(index, /<title>Mokly<\/title>/);
  assert.match(index, /data-mokly-filter/);
  assert.match(index, /\/__mokly\/client\/react-shell\.js/);
  assert.doesNotMatch(index, /\/__mokly\/client\/browser\.js/);
  assert.match(index, /href="\/view\/example\/screens\/welcome\/"/);
  assert.doesNotMatch(
    index,
    /href="\/view\/example\/screens\/welcome\/index\.html"/,
  );
  const catalogue = JSON.parse(
    await read(output, "__mokly/catalogue.json"),
  ) as PublishedCatalogue;
  const changedEntries = [
    ...catalogue.components,
    ...catalogue.pages,
    ...catalogue.screens,
    ...catalogue.useCases,
  ]
    .filter((entry) => entry.changes.included)
    .map((entry) => entry.path)
    .sort();
  assert.deepEqual(changedEntries, ["example/screens/welcome", "example/tour"]);
  const changedCount = changedEntries.length;
  assert.equal(changedCount, 2);
  const filterCount = /class="mbk-nav-filter-count">(\d+)</u.exec(index);
  assert.ok(filterCount);
  assert.equal(Number(filterCount[1]), changedCount);
  assert.match(
    navigationRow(index, "example/screens/welcome"),
    /data-changed="true"/u,
  );
  assert.doesNotMatch(
    navigationRow(index, "example/screens/details"),
    /data-changed=/u,
  );
  assert.deepEqual(
    publishedScreen(catalogue, "example/screens/welcome").changes,
    {
      included: true,
      kind: "changed",
      status: "ready",
    },
  );
  assert.deepEqual(
    publishedScreen(catalogue, "example/screens/details").changes,
    {
      included: false,
      kind: "unmodified",
      status: "ready",
    },
  );
  const welcome = await read(output, "view/example/screens/welcome/index.html");
  for (const [name, html] of [
    ["index.html", index],
    ["view/example/screens/welcome/index.html", welcome],
    ["404.html", await read(output, "404.html")],
  ] as const) {
    const state = html.match(
      /data-mokly-shell-bootstrap="" type="application\/json">([^<]+)<\/script>/,
    )?.[1];
    assert.ok(state, name);
    assert.equal(
      serializeShellBootstrap(readShellBootstrapState(JSON.parse(state))),
      state,
      name,
    );
  }
  assert.match(welcome, /Welcome · Mokly/);
  assert.match(welcome, /data-diff-screen="example\/screens\/welcome"/);
  assert.match(
    welcome,
    /class="mbk-entry-status" data-status="Changed" data-workspace-status="">Changed<\/span>/u,
  );
  for (const mode of ["current", "side", "overlay", "difference"])
    assert.match(welcome, new RegExp(`data-diff-mode="${mode}"`));
  // A static export carries the one Appearance control, and requests the asset
  // that gives it behaviour ahead of the stylesheet so the first paint is right.
  assert.match(welcome, /data-mokly-appearance-select=""/);
  assert.match(welcome, /<option value="dark">Dark<\/option>/);
  assert.doesNotMatch(welcome, /data-color-scheme-option="dark"/);
  assert.ok(
    welcome.indexOf("appearance-startup.js") < welcome.indexOf("shell.css"),
  );
  const frame = welcome.match(
    /<iframe[^>]*data-fragment-light="([^"]+)"[^>]*src="([^"]+)"/,
  );
  assert.ok(frame);
  assert.equal(frame[1], "/static/example/screens/welcome/index.mobile");
  assert.equal(frame[2], frame[1]);
  assert.match(
    welcome,
    /data-fragment-dark="\/static\/example\/screens\/welcome\/index\.mobile\.dark"/,
  );
  assert.match(
    welcome,
    /src="\/static\/example\/screens\/welcome\/index\.desktop"/,
  );
  assert.doesNotMatch(
    welcome,
    /src="\/static\/example\/screens\/welcome\/index\.desktop\.html"/,
  );
  assert.doesNotMatch(welcome, /data-fragment-(?:light|dark)="[^"]+\.html"/);
  assert.match(
    await read(output, "static/example/screens/welcome/index.desktop.html"),
    /Welcome to Mokly/,
  );
  assert.match(
    await read(
      output,
      "static/example/screens/welcome/index.desktop.dark.html",
    ),
    /data-color-scheme="dark"/,
  );
  assert.match(
    await read(output, "view/example/screens/details/index.html"),
    /class="mbk-entry-status" data-status="Unmodified" data-workspace-status="">Unmodified<\/span>/u,
  );
  assert.match(await read(output, "__mokly/shell.css"), /--mbk-/);
  assert.match(
    await read(output, "__mokly/client/appearance-startup.js"),
    /mokly:theme/,
  );
  assert.ok(
    (
      await fs.promises.stat(
        path.join(output, "__mokly/fonts/InterVariable.woff2"),
      )
    ).size > 0,
  );
  assert.match(await read(output, "404.html"), /Item not found/);
  assert.doesNotMatch(await read(output, "_redirects"), /^\/id\//m);
  assert.equal(
    await read(output, ".mokly-preview-artifact"),
    "schemaVersion=1\n",
  );
});

test("preview build refuses to replace an unowned directory", async (context) => {
  const contextDir = path.join(repositoryRoot, ".context");
  await fs.promises.mkdir(contextDir, { recursive: true });
  const root = await fs.promises.mkdtemp(
    path.join(contextDir, "preview-unowned-repository-"),
  );
  context.after(() => fs.promises.rm(root, { force: true, recursive: true }));
  const config = await createExampleBaseline(root);
  const output = path.join(root, ".context/preview");
  await fs.promises.mkdir(output, { recursive: true });
  await fs.promises.writeFile(path.join(output, "keep.txt"), "owned by user\n");

  await assert.rejects(
    buildPreview(config, output, { includeChanges: true, base: "HEAD" }),
    /refusing to replace unowned preview directory/,
  );
  assert.equal(await read(output, "keep.txt"), "owned by user\n");
});

async function assertClientGraphIsComplete(output: string): Promise<void> {
  const assetRoot = path.join(output, "__mokly");
  const copied = await javascriptFiles(assetRoot);
  assert.ok(copied.length > 0);
  for (const module of copied) {
    const source = await fs.promises.readFile(
      path.join(assetRoot, module),
      "utf8",
    );
    for (const target of relativeImports(source)) {
      const resolved = path.normalize(path.join(path.dirname(module), target));
      assert.ok(
        copied.includes(resolved),
        `${module} imports missing preview module ${resolved}`,
      );
    }
  }
}

async function javascriptFiles(root: string, relative = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.promises.readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    const candidate = path.join(relative, entry.name);
    if (entry.isDirectory())
      files.push(...(await javascriptFiles(root, candidate)));
    else if (entry.isFile() && entry.name.endsWith(".js"))
      files.push(candidate);
  }
  return files;
}

async function read(root: string, relative: string): Promise<string> {
  return await fs.promises.readFile(path.join(root, relative), "utf8");
}

function relativeImports(source: string): string[] {
  const targets: string[] = [];
  const pattern = /(?:^|\s)(?:from|import)\s+"((?:\.\.?\/)[^"]+)"/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1] !== undefined) targets.push(match[1]);
  }
  return targets;
}

interface PublishedEntry {
  readonly changes: {
    readonly included: boolean;
    readonly kind: string;
    readonly status: string;
  };
  readonly path: string;
}

interface PublishedCatalogue {
  readonly components: readonly PublishedEntry[];
  readonly pages: readonly PublishedEntry[];
  readonly screens: readonly PublishedEntry[];
  readonly useCases: readonly PublishedEntry[];
}

function navigationRow(source: string, id: string): string {
  const rows = source.match(/<a\b[^>]*data-nav-row=""[^>]*>/gu) ?? [];
  const row = rows.find((candidate) =>
    candidate.includes(`data-entry-id="${id}"`),
  );
  assert.ok(row, `missing navigation row for ${id}`);
  return row;
}

function publishedScreen(
  catalogue: PublishedCatalogue,
  id: string,
): PublishedEntry {
  const screen = catalogue.screens.find((entry) => entry.path === id);
  assert.ok(screen, `missing published screen ${id}`);
  return screen;
}
