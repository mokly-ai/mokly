import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  installedRendererContract,
  RENDERING_PROTOCOL_PATH,
  rendererContractSnippet,
} from "../scripts/package/renderer_contract.mjs";

test("the packed NodeNext consumer extracts the documented renderer contract", async () => {
  const markdown = await fs.readFile(RENDERING_PROTOCOL_PATH, "utf8");
  const snippet = rendererContractSnippet(markdown);

  assert.match(snippet, /ComponentVariantDefinition/);
  assert.match(
    snippet,
    /entry: ScreenDefinition \| ComponentVariantDefinition/,
  );
  assert.doesNotMatch(snippet, /\bComponentDefinition\b/);
  assert.match(snippet, /export default function render/);
});

test("the packed NodeNext consumer reads the contract from its installed package", async (t) => {
  const consumer = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-renderer-contract-"),
  );
  t.after(() => fs.rm(consumer, { recursive: true, force: true }));
  const checkout = await fs.readFile(RENDERING_PROTOCOL_PATH, "utf8");
  const shipped = checkout.replace(
    "  viewport: Viewport;\n}",
    "  viewport: Viewport;\n  shippedOnly: true;\n}",
  );
  assert.notEqual(shipped, checkout);
  const installed = path.join(
    consumer,
    "node_modules/@mokly/mokly",
    RENDERING_PROTOCOL_PATH,
  );
  await fs.mkdir(path.dirname(installed), { recursive: true });
  await fs.writeFile(installed, shipped);

  const snippet = await installedRendererContract(consumer);

  assert.equal(snippet, rendererContractSnippet(shipped));
  assert.notEqual(snippet, rendererContractSnippet(checkout));
});

test("a packed package without the rendering protocol fails the NodeNext consumer", async (t) => {
  const consumer = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-renderer-contract-"),
  );
  t.after(() => fs.rm(consumer, { recursive: true, force: true }));

  await assert.rejects(installedRendererContract(consumer), {
    code: "ENOENT",
  });
});
