import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

test("the CLI runtime avoids eager ESM-to-CommonJS edges", async () => {
  const loader = `
    const publishOrNativeOnly = new Set(["lightningcss", "tar-stream"]);
    export async function resolve(specifier, context, nextResolve) {
      if (publishOrNativeOnly.has(specifier))
        throw new Error("eager CommonJS dependency resolved: " + specifier);
      return nextResolve(specifier, context);
    }
  `;
  const loaderUrl = `data:text/javascript,${encodeURIComponent(loader)}`;
  const runUrl = pathToFileURL(
    path.join(repositoryRoot, "dist/cli/run.js"),
  ).href;
  const source = `
    import { register } from "node:module";
    register(${JSON.stringify(loaderUrl)});
    await import(${JSON.stringify(runUrl)});
  `;

  await assert.doesNotReject(() =>
    promisify(execFile)(
      process.execPath,
      ["--input-type=module", "--eval", source],
      { cwd: repositoryRoot },
    ),
  );
});
