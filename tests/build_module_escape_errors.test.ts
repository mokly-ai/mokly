import assert from "node:assert/strict";
import test from "node:test";

import { removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

const advice =
  "write the escape with at most five hex digits followed by exactly one space, then any spacing or comment";

for (const [name, css, location] of [
  ["tab-ended escape", `.a\\31\t.b{color:red}`, "1:1"],
  ["nested escape", `.outer{\n.a\\31\t.b{color:red}}`, "2:1"],
  [
    "scope start comment",
    String.raw`@scope (.a\31/**/ .b){.x{color:red}}`,
    "1:1",
  ],
  [
    "scope limit comment",
    String.raw`@scope (.start) to (.a\31/**/ .b){.x{color:red}}`,
    "1:1",
  ],
] as const)
  test(`Build reports unsafe ${name} at its authored location`, async (context) => {
    const fixture = await styleFixture(css, { module: true });
    context.after(() => removeFixture(fixture));
    await assert.rejects(
      () => compileFixture(fixture),
      (error: Error) => {
        assert.equal(
          error.message,
          `[mokly/build-invalid] CSS Modules cannot safely scope an escape in entries/fixture.module.css:${location}; ${advice}`,
        );
        return true;
      },
    );
  });
