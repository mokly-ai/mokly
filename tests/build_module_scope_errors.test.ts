import assert from "node:assert/strict";
import test from "node:test";

import { removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

for (const [name, css, message] of [
  [
    "malformed prelude",
    "@scope (.button) to {.x{color:red}}",
    "CSS Modules @scope prelude is invalid in entries/fixture.module.css:1:1; use an optional (start) and/or to (limit)",
  ],
  [
    "scroll animation",
    ".x{animation:grow-progress auto linear}",
    "CSS Modules scoping would change more than local names in entries/fixture.module.css:1:1; move this CSS to a plain stylesheet",
  ],
  [
    "quoted keyframes",
    '@keyframes "pulse"{to{opacity:1}}',
    "CSS Modules scoping would change more than local names in entries/fixture.module.css:1:1; move this CSS to a plain stylesheet",
  ],
] as const)
  test(`Build rejects ${name} with catalogued guidance`, async (context) => {
    const fixture = await styleFixture(css, { module: true });
    context.after(() => removeFixture(fixture));
    await assert.rejects(
      () => compileFixture(fixture),
      (error: Error) => {
        assert.equal(error.message, `[mokly/build-invalid] ${message}`);
        return true;
      },
    );
  });

test("animation-name ease still passes unchanged for now", async (context) => {
  const fixture = await styleFixture(
    "@keyframes ease{to{opacity:1}}.x{animation-name:ease}",
    { module: true },
  );
  context.after(() => removeFixture(fixture));
  const output = (await compileFixture(fixture)).outputs;
  const stylesheet = [...output].find(([route]) =>
    route.endsWith(".tsx.css"),
  )?.[1];
  assert.ok(typeof stylesheet === "string");
  assert.match(stylesheet, /animation-name: ease/);
});

test("Build delivers @scope with to-names in its start and limit", async (context) => {
  const fixture = await styleFixture(
    "@scope (.button) to (.footer){.target{color:red}}",
    { module: true },
  );
  context.after(() => removeFixture(fixture));
  const stylesheet = [...(await compileFixture(fixture)).outputs].find(
    ([route]) => route.endsWith(".tsx.css"),
  )?.[1];
  assert.ok(typeof stylesheet === "string");
  assert.match(
    stylesheet,
    /@scope \(\.mokly_[a-f0-9]{12}_button\) to \(\.mokly_[a-f0-9]{12}_footer\)/,
  );
});
