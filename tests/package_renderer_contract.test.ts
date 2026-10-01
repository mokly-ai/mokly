import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { rendererContractSnippet } from "../scripts/package/renderer_contract.mjs";

test("the packed NodeNext consumer extracts the documented renderer contract", async () => {
  const markdown = await fs.readFile(
    "docs/protocol/mokly-rendering.md",
    "utf8",
  );
  const snippet = rendererContractSnippet(markdown);

  assert.match(snippet, /ComponentVariantDefinition/);
  assert.match(
    snippet,
    /entry: ScreenDefinition \| ComponentVariantDefinition/,
  );
  assert.doesNotMatch(snippet, /\bComponentDefinition\b/);
  assert.match(snippet, /export default function render/);
});
