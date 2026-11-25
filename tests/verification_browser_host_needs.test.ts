import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { copiedHostSpecs } from "../scripts/verification/browser-host-needs.mjs";

const FILES: Record<string, string> = {
  "tests/browser/static_test.ts": "export const copied = 1;\n",
  "tests/browser/cases.ts":
    'import { copied } from "./static_test.js";\nimport { loop } from "./loop.js";\nexport { copied, loop };\n',
  "tests/browser/loop.ts": 'import "./cases.js";\nexport const loop = 1;\n',
  "tests/browser/plain.ts": "export const plain = 1;\n",
  "tests/browser/direct.spec.ts":
    'const host = await import("./static_test.js");\nvoid host;\n',
  "tests/browser/through_cases.spec.ts": 'import { loop } from "./loop.js";\n',
  "tests/browser/plain.spec.ts":
    'import { plain } from "./plain.js";\nconst page = `import("./packages/frame/dist/x.js")`;\nvoid page;\n',
};

test("specs that reach the copied host module through any import chain need the copy", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-host-needs-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(FILES)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  }
  const specs = [
    "tests/browser/direct.spec.ts",
    "tests/browser/plain.spec.ts",
    "tests/browser/through_cases.spec.ts",
  ];
  assert.deepEqual(
    [...(await copiedHostSpecs(root, specs))],
    ["tests/browser/direct.spec.ts", "tests/browser/through_cases.spec.ts"],
  );
});
