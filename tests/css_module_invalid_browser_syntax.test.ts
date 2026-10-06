import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { scopeModule } from "../packages/mokly/dist/build/styles/modules.js";

const relative = "entries/invalid-browser.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;

for (const selector of [
  ".card:host(.a,.b).active",
  ".card::slotted(.a,.b).active",
  ".card::slotted(.a).active",
  ".card:not(.a,).active",
  ".card:has(.a,).active",
  ".card:nth-child(2 of .a,).active",
] as const)
  test(`existing module pipeline preserves invalid browser selector ${selector}`, () => {
    const output = scopeModule(`${selector}{color:red}`, relative).css;
    assert.equal(output.replaceAll(prefix, ""), `${selector}{color:red}`);
  });
