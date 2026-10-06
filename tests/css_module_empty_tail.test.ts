import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { scopeModule } from "../packages/mokly/dist/build/styles/modules.js";

const relative = "entries/tail.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;

for (const [selector, expected] of [
  [".w:global(.x, ,):hover", ".M_w.x :hover"],
  [".w:global(.x , ,):hover", ".M_w.x :hover"],
  [".w:local(.x,\n,):hover", ".M_w.M_x\n:hover"],
  [".w:global(.x, /* c */,):hover", ".M_w.x :hover"],
  [".w:global(.x,/* c */ ,):hover", ".M_w.x :hover"],
  [".w:global(.x, ,/* c */):hover", ".M_w.x :hover"],
  [".w:global(.x,, ):hover", ".M_w.x :hover"],
  [".w:global(.x, , ):hover", ".M_w.x :hover"],
  [".w:global(.x ,):hover", ".M_w.x:hover"],
  [".w:global(.x,/* c */,):hover", ".M_w.x:hover"],
  [".w:global(.x,,):hover", ".M_w.x:hover"],
  [".a:is(.b :global(.x, )/*c*/).c", ".M_a:is(.M_b .x /*c*/).M_c"],
  [".a:is(.b :global(.x, ) /*c*/).c", ".M_a:is(.M_b .x ) .M_c"],
  [".a:is(.b :global(.x, )).c", ".M_a:is(.M_b .x) .M_c"],
  [".w:global(.x, )/*c*/:hover", ".M_w.x /*c*/:hover"],
  [".w :global(.x/* a /* b */,.y)", ".M_w .x/* a /* b */.y"],
  [".w :global(.x/* a */ ,.y)", ".M_w .x .y"],
  [".a:is(:not(.b :global(.x, )/*c*/)).c", ".M_a:is(:not(.M_b .x /*c*/)).M_c"],
  [".a:is(:not(.b :global(.x, ))).c", ".M_a:is(:not(.M_b .x)) .M_c"],
  [".w:global(.x, ,):local(.y, )", ".M_w.x .M_y"],
  [".w:global(.x, ,):global(.y, ,):hover", ".M_w.x .y :hover"],
] as const)
  test(`CSS Module wrapper tail ${JSON.stringify(selector)}`, () => {
    const actual = scopeModule(`${selector}{color:red}`, relative);
    assert.equal(actual.css.replaceAll(prefix, "M_"), `${expected}{color:red}`);
  });
