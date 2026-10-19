import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

test("a preloaded Node transform never labels transformed text as a raw file digest", async (context) => {
  const { base } = await sidecarSources(context);
  const plugin = path.join(base, "node_modules/plugin");
  await fs.mkdir(plugin, { recursive: true });
  await fs.writeFile(
    path.join(plugin, "package.json"),
    JSON.stringify({ name: "plugin", type: "module", main: "index.mjs" }),
  );
  const original =
    "export default ()=>({postcssPlugin:'plugin',Once(root){root.append({prop:'from',value:'original'})}});";
  await fs.writeFile(path.join(plugin, "index.mjs"), original);
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    "export default {plugins:{plugin:{}}};",
  );
  const loader = path.join(base, "loader.mjs");
  await fs.writeFile(
    loader,
    `
import {registerHooks} from 'node:module';
registerHooks({load(url,context,nextLoad){
const result=nextLoad(url,context);
if(url===${JSON.stringify(pathToFileURL(path.join(plugin, "index.mjs")).href)})
return {...result,source:Buffer.from(${JSON.stringify(original.replace("original", "transformed"))})};
return result;
}});`,
  );
  const sidecar = startSidecar(context, undefined, {
    ...process.env,
    NODE_OPTIONS: [
      process.env.NODE_OPTIONS,
      `--import=${pathToFileURL(loader).href}`,
    ]
      .filter(Boolean)
      .join(" "),
  });
  await sidecar.call("hello");
  const params = cssParams({
    sourceRoot: base,
    repositoryRoots: [],
    text: "a{}",
  });
  params.moduleResolution.packageRoots = [base];
  const result = await sidecar.call<CssResult>("processCss", params);
  assert.match(result.text, /from: transformed/);
  const witnessed = result.readEvidence.reads.filter(
    (read) => read.path === path.join(plugin, "index.mjs"),
  );
  assert.ok(
    witnessed.every(
      (read) =>
        read.digest === createHash("sha256").update(original).digest("hex"),
    ),
    "transformed compiler text cannot stand in for raw file bytes",
  );
  assert.equal(result.readEvidence.coverage, "incomplete");
});
