import assert from "node:assert/strict";
import test from "node:test";

import { registryStyles } from "../packages/mokly/src/sidecar/registry-styles.js";

test("registry selection retains used rules, resets, enclosing at-rules and animation dependencies", () => {
  const css =
    "html{margin:0}@media (min-width:1px){.used:hover{animation:spin 1s;color:red}.unused{color:blue}}@keyframes spin{to{opacity:0}}@keyframes unused{to{opacity:1}}";
  assert.equal(
    registryStyles(css, '<i class="used"></i>'),
    "html{margin:0}@media (min-width:1px){.used:hover{animation:spin 1s;color:red}}@keyframes spin{to{opacity:0}}",
  );
  assert.equal(
    registryStyles(".a\\:b{color:red}.c{color:blue}", '<i class="a:b"></i>'),
    ".a\\:b{color:red}",
  );
});
