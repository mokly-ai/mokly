import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { requirePrepared } from "../scripts/verification/prepared.mjs";

const outputs = [
  "packages/viewer/dist/index.js",
  "packages/viewer/dist/browser/inspector.js",
];

test("prepared verification names every missing viewer output", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-prepared-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const missing = (files: readonly string[]) => ({
    message: `prepared verification output is missing: ${files.join(", ")}; run npm run build first`,
  });
  await assert.rejects(requirePrepared(root), missing(outputs));
  for (const [index, name] of outputs.entries()) {
    const file = path.join(root, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.mkdir(file);
    await assert.rejects(requirePrepared(root), missing(outputs.slice(index)));
    await fs.rm(file, { recursive: true });
    await fs.writeFile(file, "built");
    if (index === 0)
      await assert.rejects(requirePrepared(root), missing(outputs.slice(1)));
  }
  await requirePrepared(root);
});
