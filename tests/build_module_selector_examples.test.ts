import assert from "node:assert/strict";
import test from "node:test";

import postcss from "postcss";

import { removeFixture } from "./helpers/fixture.js";
import {
  compileFixture,
  entryStyle,
  styleFixture,
} from "./helpers/imported_styles_fixture.js";

const changed =
  "CSS Modules scoping would change more than local names in entries/fixture.module.css:1:1; move this CSS to a plain stylesheet";
const emptyGlobal =
  "CSS Modules :global() has no selector in entries/fixture.module.css:1:1; add a selector inside it or remove it";

for (const [source, delivered, error] of [
  [".wrap :global(.x, .y)", ".wrap .x .y"],
  [".wrap :global(.x ,.y)", ".wrap .x .y"],
  [".wrap :global(.x,\n.y)", ".wrap .x .y"],
  [".wrap :global(.x,.y)", ".wrap .x.y"],
  [".wrap :local(.x,.y)", ".wrap .x.y"],
  [".wrap :global(, .x)", ".wrap .x"],
  [".wrap :global(.x, .y,)", ".wrap .x .y"],
  [".wrap:global(.x,.y)", ".wrap.x.y"],
  [":global(.x,.y).wrap", ".x.y.wrap"],
  [".w:global(.x, ):hover", ".w.x :hover"],
  [".w:global(.a, ):global(.x)", ".w.a .x"],
  [".wrap :global(.x), .wrap :global(.y)", ".wrap .x,\n.wrap .y"],
  [".wrap :global(:is(.x, .y))", ".wrap :is(.x, .y)"],
  [".wrap :global(.x,.y)/**/.tail", ".wrap .x.y.tail"],
  [".w :global(::before,.x)", ".w ::before .x"],
  [".card:is(.a,).b", ".card:is(.a, ).b"],
  [".card:is(.a, ).b", undefined, changed],
  [".w :global(.a,:is(.b, ),.c)", undefined, changed],
  [":global()", undefined, emptyGlobal],
  [":global( )", undefined, emptyGlobal],
  [":global(,)", undefined, emptyGlobal],
  [":global(/* c */)", undefined, emptyGlobal],
  [".w :global(div,span)", undefined, changed],
  [".w :global(.x,div)", undefined, changed],
  [".w :global([a],div)", undefined, changed],
  [".w:global(div)", undefined, changed],
] as const)
  test(`Build documents selector ${JSON.stringify(source)}`, async (context) => {
    const fixture = await styleFixture(`${source}{color:red}`, {
      module: true,
    });
    context.after(() => removeFixture(fixture));
    if (error) {
      await assert.rejects(
        () => compileFixture(fixture),
        (failure: Error) => {
          assert.equal(failure.message, `[mokly/build-invalid] ${error}`);
          return true;
        },
      );
      return;
    }
    const css = (await compileFixture(fixture)).outputs.get(entryStyle);
    assert.equal(typeof css, "string");
    const selector = (postcss.parse(css as string).first as postcss.Rule)
      .selector;
    assert.equal(selector.replaceAll(/mokly_[a-f0-9]{12}_/gu, ""), delivered);
  });
