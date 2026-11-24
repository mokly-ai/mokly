import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";

import {
  envSnapshot,
  linkIgnoredViteEnv,
  viteEnvChangesFixture,
} from "./fixtures/vite_env_changes.js";
import { completed, serve } from "./helpers/mokly_serve.js";
import { build, write } from "./helpers/static_changes.js";

test("Vite Changes shares ignored env files and preserves base and index precedence", async (context) => {
  const root = await viteEnvChangesFixture(context);
  const { index, output, stderr } = await build(root);
  assert.equal(index.changesStatus, "ready", stderr);
  assert.ok(index.comparisonUrl, stderr);
  assert.deepEqual(
    Object.fromEntries(
      index.screens.map(({ path, changes }) => [path, changes]),
    ),
    {
      local: { status: "ready", kind: "unmodified", included: false },
      tracked: { status: "ready", kind: "changed", included: true },
      staged: { status: "ready", kind: "changed", included: true },
      removed: { status: "ready", kind: "changed", included: true },
    },
  );
  assert.match(
    await envSnapshot(output, "static", "local"),
    /<h1>expanded-local<\/h1>/,
  );
  for (const [screen, before, after] of [
    ["tracked", "base", "head"],
    ["staged", "missing", "index-only"],
    ["removed", "base-only-tracked", "working-copy"],
  ] as const) {
    assert.match(
      await envSnapshot(
        output,
        `${index.comparisonUrl}/snapshots/before`,
        screen,
      ),
      new RegExp(`<h1>${before}</h1>`),
    );
    assert.match(
      await envSnapshot(
        output,
        `${index.comparisonUrl}/snapshots/after`,
        screen,
      ),
      new RegExp(`<h1>${after}</h1>`),
    );
  }
});

test("Vite Changes shares a Git-ignored dotenv symlink outside the checkout", async (context) => {
  const root = await viteEnvChangesFixture(context);
  const target = await linkIgnoredViteEnv(context, root);
  const { index, output, stderr } = await build(root);
  assert.equal(index.changesStatus, "ready", stderr);
  assert.deepEqual(
    index.screens.find(({ path }) => path === "local")?.changes,
    {
      status: "ready",
      kind: "unmodified",
      included: false,
    },
  );
  assert.match(
    await envSnapshot(output, "static", "local"),
    /<h1>expanded-local<\/h1>/,
  );
  assert.equal(stderr.includes(target), false);
});

test("Vite Serve refreshes a kept base when a shared dotenv file changes", async (context) => {
  const root = await viteEnvChangesFixture(context);
  const server = await serve(context, root, process.env, [], true);
  const url = await server.ready();
  const signal = AbortSignal.any([context.signal, server.signal]);
  const current = async (afterRevision: number) => {
    const { index } = await completed(url, signal, "local", fetch, {
      afterRevision,
      requireReady: true,
    });
    const parsed = readCatalogueIndex(index);
    assert.deepEqual(
      parsed.screens.find(({ path }) => path === "local")?.changes,
      {
        status: "ready",
        kind: "unmodified",
        included: false,
      },
    );
    return parsed.revision;
  };
  try {
    const previous = await current(0);
    await write(root, "env/.env.local", "VITE_TRACK_D_LOCAL=edited-local\n");
    await current(previous);
    const response = await fetch(
      `${url}/static/mokly-generated/local/index.mobile.html`,
      { signal },
    );
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<h1>edited-local<\/h1>/);
  } finally {
    await server.close();
  }
});
