/** Verify hook routing and runtime-derived assertion exports. */
import assert from "node:assert/strict";
import * as strict from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  initialize,
  load,
  resolve,
} from "../scripts/verification/assertion-guard-hooks.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const root = pathToFileURL(`${repositoryRoot}/`).href;

test("the resolve hook counts only assertion imports from repository files", async () => {
  initialize({ root });
  const next = async () => ({ url: "native:unchanged" });
  for (const specifier of [
    "node:assert",
    "assert",
    "node:assert/strict",
    "assert/strict",
  ]) {
    const result = await resolve(
      specifier,
      { parentURL: `${root}tests/example.mjs` },
      next,
    );
    assert.equal(result.shortCircuit, true);
    assert.match(result.url, /^mokly-assertion:/u);
    for (const parentURL of [
      undefined,
      `${root}node_modules/example/index.mjs`,
      `${root}scripts/verification/assertion-guard-counting.mjs`,
      "file:///outside/example.mjs",
    ])
      assert.deepEqual(await resolve(specifier, { parentURL }, next), {
        url: "native:unchanged",
      });
  }
  assert.deepEqual(
    await resolve("node:fs", { parentURL: `${root}tests/example.mjs` }, next),
    { url: "native:unchanged" },
  );
});

test("the load hook generates every named export on this Node release", async () => {
  const next = async () => ({ format: "module", source: "native" });
  const route = await resolve(
    "node:assert/strict",
    { parentURL: `${root}tests/example.mjs` },
    async () => ({ url: "unexpected" }),
  );
  const result = await load(route.url, {}, next);
  assert.equal(result.shortCircuit, true);
  assert.equal(result.format, "module");
  assert.equal(typeof result.source, "string");
  for (const name of Object.keys(strict).filter((name) => name !== "default"))
    assert.ok(String(result.source).includes(`export const ${name} =`), name);
  assert.deepEqual(await load("file:///other.mjs", {}, next), {
    format: "module",
    source: "native",
  });
});
