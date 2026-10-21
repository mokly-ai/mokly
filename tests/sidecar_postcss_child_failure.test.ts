import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

test(
  "a PostCSS configuration failure retains its cause and the sidecar remains usable",
  { timeout: 30_000 },
  async (context) => {
    const { base } = await sidecarSources(context);
    await fs.writeFile(
      path.join(base, "postcss.mjs"),
      "throw new Error('fixture configuration failed'); export default {plugins:[]};",
    );
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    await assert.rejects(
      sidecar.call("processCss", cssParams({ sourceRoot: base })),
      {
        code: "bundle-failed",
        message: /fixture configuration failed/,
      },
    );
    await sidecar.call("disposeContext", { context: "css" });
    await fs.writeFile(
      path.join(base, "postcss.mjs"),
      "export default {plugins:[]};",
    );
    const result = await sidecar.call<CssResult>(
      "processCss",
      cssParams({ sourceRoot: base, text: "p { color: red }" }),
    );
    assert.match(result.text, /color: red/);
    await sidecar.call("shutdown");
  },
);

for (const phase of ["startup", "configuration"] as const)
  test(
    `a real PostCSS child failure during ${phase} rejects its request`,
    { timeout: 30_000 },
    async (context) => {
      const { root, base } = await sidecarSources(context);
      const env = { ...process.env };
      if (phase === "startup") {
        const preload = path.join(root, "child-failure.mjs");
        await fs.writeFile(
          preload,
          "if (typeof process.send === 'function') throw new Error('fixture startup failed');",
        );
        env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --import=${pathToFileURL(preload).href}`;
      }
      await fs.writeFile(
        path.join(base, "postcss.mjs"),
        phase === "startup"
          ? "export default {plugins:[]};"
          : "process.exit(23); export default {plugins:[]};",
      );
      const sidecar = startSidecar(context, undefined, env);
      await sidecar.call("hello");
      await assert.rejects(
        sidecar.call("processCss", cssParams({ sourceRoot: base })),
        {
          code: "bundle-failed",
          message: /postcss\.mjs: PostCSS worker (exited|disconnected)/,
        },
      );
      await sidecar.call("shutdown");
    },
  );
