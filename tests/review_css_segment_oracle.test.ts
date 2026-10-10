import test from "node:test";

import { compareInlineOracle } from "./helpers/inline_analysis_oracle.js";
import { html, inlineInput } from "./helpers/inline_styles.js";

test("the captured M4 engine pins ordered attribution and both materials", () => {
  const input = inlineInput({
    before: html(
      '<style>.a{color:red}.b{background:url("x.svg")}</style>',
      '<main class="a b"></main>',
    ),
    after: html(
      '<style>.a{color:blue}.b{background:url("x.svg")}</style>',
      '<main class="a b"></main>',
    ),
  });
  compareInlineOracle(input);
});
