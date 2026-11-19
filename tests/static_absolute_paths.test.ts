import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { absolutePaths } from "./helpers/absolute_paths.js";
import { nativeRoot, write } from "./helpers/native_resolution.js";
import { command, workspace } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

test("strict builds replace cached HTML after an earlier absolute paths target appears", async (context) => {
  const scratch = path.join(workspace, ".context");
  await fs.mkdir(scratch, { recursive: true });
  const parent = await nativeRoot(context, scratch);
  const { root, addEarlier } = await absolutePaths(context, "exact", parent);
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
  const changed = await compile();
  assert.match(changed.html, /<main>one<\/main>/);
  assert.equal(changed.compiles, 1);
});
