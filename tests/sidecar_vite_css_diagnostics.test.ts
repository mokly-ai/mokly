import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { viteStylesheetFailure } from "../packages/mokly/src/sidecar/vite-errors.js";
import { viteCss, viteUrl } from "../packages/mokly/src/sidecar/vite-urls.js";

test("Vite stylesheet diagnostics omit positions outside the repository or in a virtual module", () => {
  const sourceRoot = path.resolve("repository");
  const dependency = path.resolve(
    "installation/node_modules/palette/theme.css",
  );
  const virtual = viteUrl(viteCss(path.join(sourceRoot, "src/theme.css")));
  const paths = {
    sourceRoot,
    name: (file: string) =>
      file === dependency ? "node_modules/palette/theme.css" : "src/theme.css",
  };
  const messages = [dependency, virtual].map((file) => {
    const error = Object.assign(new Error("cannot transform"), {
      loc: { file, line: 2, column: 4 },
    });
    return viteStylesheetFailure(error, paths, "src/site.scss").message;
  });
  const message =
    "Vite plugin vite failed for src/site.scss: cannot transform; fix the Vite setup or the stylesheet";
  assert.deepEqual(messages, [message, message]);
});
