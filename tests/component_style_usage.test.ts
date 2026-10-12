import assert from "node:assert/strict";
import test from "node:test";

import { compareComponentView } from "../dist/review/component_view.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { pageContext } from "./helpers/page_comparison.js";
import {
  assertStyleRoute,
  selectedStyleViews,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

const styles = [
  "<style>.actual-only{color:red}</style>",
  "<style>.actual-only{color:blue}</style>",
] as const;
const source = componentEntrySource({
  actionRender: '() => <button className="actual-only">Action</button>',
  body: '<action.Component moklyInstance="footer" label="Finish" />',
});

for (const mode of ["committed", "derived"] as const) {
  test(`style route preserves entry inputs and root ownership in ${mode}`, async (context) => {
    const fixture = await styleRouteFixture(
      context,
      (text) => text.replace('label="Finish"', 'label="Done"'),
      source,
    );
    const input = withHeadStyles(fixture, ...styles, mode);
    const { comparison } = await assertStyleRoute(input, "style");
    assert.deepEqual(comparison.reasons, [
      { kind: "material" },
      { kind: "inputs" },
    ]);
    assert.deepEqual([...comparison.changedImplementations], []);
    const root = await assertStyleRoute(input, "style", "action/default");
    assert.deepEqual(root.comparison.reasons, [{ kind: "material" }]);
    assert.deepEqual([...root.comparison.changedImplementations], []);
  });
  test(`unequal topology and owned styles take the complete path in ${mode}`, async (context) => {
    const changed = await styleRouteFixture(
      context,
      (text) =>
        text.replace('moklyInstance="footer"', 'moklyInstance="different"'),
      source,
    );
    await assertStyleRoute(
      withHeadStyles(changed, ...styles, mode),
      "complete",
    );
    const owned = await styleRouteFixture(
      context,
      (text) => text.replace("color:red", "color:blue"),
      source
        .replace(
          '<button className="actual-only">',
          '<><style>{".actual-only{color:red}"}</style><button className="actual-only">',
        )
        .replace("Action</button>", "Action</button></>"),
    );
    await assertStyleRoute({ ...owned, config: owned.config }, "complete");
  });
  test(`missing usage, one-sided views and component-free scope bypass the route in ${mode}`, async (context) => {
    const fixture = withHeadStyles(
      await styleRouteFixture(context),
      ...styles,
      mode,
    );
    const { before, after } = selectedStyleViews(fixture);
    const { usage: _usage, ...withoutUsage } = before;
    for (const [left, right, componentAware] of [
      [withoutUsage, after, true],
      [before, { ...withoutUsage, path: after.path }, true],
      [undefined, after, true],
      [before, undefined, true],
      [before, after, false],
    ] as const) {
      const enabled = await compareComponentView(
        pageContext(fixture, componentAware),
        left,
        right,
      );
      const oracle = await compareComponentView(
        {
          ...pageContext(fixture, componentAware),
          useFastPath: false,
          useStylePath: false,
        },
        left,
        right,
      );
      assert.equal(enabled.comparisonPath, "complete");
      assert.deepEqual(enabled, oracle);
    }
  });
  test(`route switches preserve document validation in ${mode}`, async (context) => {
    const fixture = withHeadStyles(
      await styleRouteFixture(context),
      ...styles,
      mode,
    );
    const { before, after } = selectedStyleViews(fixture);
    for (const invalid of [
      (text: string) => text.replace("<!--mokly-component:end:r-0-->", ""),
      (text: string) =>
        text.replace(
          "</head>",
          "<!--mokly-review-ignore:start:broken--></head>",
        ),
      (text: string) =>
        text.replace(
          "</head>",
          "<!--mokly-review-material:missing:invalid--></head>",
        ),
    ])
      for (const side of ["beforeFiles", "afterFiles"] as const) {
        const files = new Map(fixture[side]);
        files.set(
          after.path,
          invalid(Buffer.from(files.get(after.path)!).toString()),
        );
        const input = { ...fixture, [side]: files };
        for (const useFastPath of [false, true])
          for (const useStylePath of [false, true])
            await assert.rejects(
              compareComponentView(
                { ...pageContext(input), useFastPath, useStylePath },
                before,
                after,
              ),
            );
      }
  });
}
