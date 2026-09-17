import fs from "node:fs/promises";

import { build } from "esbuild";
import { minify } from "terser";

import {
  inspectorPool,
  inspectorPrivateProperties,
} from "./inspector-pool.mjs";

/** The result is one ordinary IIFE: no evaluator, compressed code or runtime imports. */
export async function bundleInspector(entryPoint, outfile) {
  const result = await build({
    bundle: true,
    entryPoints: [entryPoint],
    format: "esm",
    minifySyntax: true,
    platform: "browser",
    target: "es2023",
    write: false,
    logLevel: "silent",
  });
  const { code } = await minify(inspectorPool(result.outputFiles[0].text), {
    ecma: 2023,
    compress: { passes: 5, toplevel: true },
    mangle: { properties: { regex: inspectorPrivateProperties } },
    format: { comments: false },
  });
  if (!code) throw new Error("Inspector minification produced no code");
  await fs.writeFile(outfile, code);
}
