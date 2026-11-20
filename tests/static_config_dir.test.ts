import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";

import { configDirPaths } from "./helpers/config_dir.js";
import { durableRoot } from "./helpers/durable_fixture.js";
import { nativeRoot, write } from "./helpers/native_resolution.js";
import { command } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

test("strict builds replace cached HTML after an earlier configDir paths target appears", async (context) => {
  const parent = await durableRoot(context, "static-config-dir");
  const { root, params, addEarlier } = await configDirPaths(context, parent);
  const cache = await nativeRoot(context, parent);
  await fs.mkdir(path.join(root, ".context"));
  await write(path.join(root, "mokly.config.json"), "{}");
  await write(
    path.join(root, "specs/home.mockup.ts"),
    `import {definePage} from '@mokly/mokly'; import {value} from '../entry.mjs'; export default definePage({title:'Home',description:'',relatedDocs:[],render:()=>'<!doctype html><html><head><title>Home</title></head><body><main>'+value+'</main></body></html>'});`,
  );
  const compile = async () => {
    const result = await command(
      root,
      "build",
      [
        "--strict",
        "--no-changes",
        "--sidecars=1",
        "--debug-timings",
        "--out=.context/site",
      ],
      "plain",
      { XDG_CACHE_HOME: cache, LOCALAPPDATA: cache },
      context.signal,
    ).result;
    assert.equal(result.code, 0, result.stderr);
    return {
      html: await fs.readFile(
        path.join(root, ".context/site/static/mokly-generated/home/index.html"),
        "utf8",
      ),
      compiles: timings(result.stderr).filter(
        (record) =>
          record.stage === "sidecar.bundle.compile" && record.event === "start",
      ).length,
    };
  };
  const original = await compile();
  assert.match(original.html, /<main>two<\/main>/);
  assert.equal(original.compiles, 1);
  const unchanged = await compile();
  assert.equal(unchanged.html, original.html);
  assert.equal(unchanged.compiles, 0);
  await addEarlier();
  const fresh = await bundle(params, build);
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
  const changed = await compile();
  assert.match(changed.html, /<main>one<\/main>/);
  assert.equal(changed.compiles, 1);
});
