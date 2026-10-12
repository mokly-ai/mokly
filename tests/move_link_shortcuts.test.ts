import assert from "node:assert/strict";
import test from "node:test";

import {
  compareComponentView,
  type ComparedComponentView,
} from "../dist/review/component_view.js";

import { moveLinkShortcutFixture } from "./helpers/move_link_shortcuts.js";
import { styleSwitches } from "./helpers/style_switches.js";

for (const mode of ["committed", "derived"] as const)
  for (const styleEdit of [false, true])
    test(`shortcuts preserve changed link identity at a reused path: ${mode}, style=${styleEdit}`, async (t) => {
      const fixture = await moveLinkShortcutFixture(t, mode, styleEdit);
      assert.deepEqual(fixture.input.pairing.moves, [
        { kind: "page", path: "moved", previousPath: "target" },
      ]);
      for (const [index, before] of fixture.beforeViews.entries()) {
        const after = fixture.afterViews[index]!;
        if (!styleEdit)
          assert.equal(
            fixture.before.outputs.get(before.path),
            fixture.after.outputs.get(after.path),
          );
        const oracle = await compareComponentView(
          {
            ...(await fixture.context()),
            useFastPath: false,
            useStylePath: false,
            useMaterialFingerprints: false,
          },
          before,
          after,
        );
        assert.equal(oracle.view.state, "changed");
        assert.equal(oracle.view.material, true);
        assert.deepEqual(oracle.reasons, [{ kind: "material" }]);
        for (const switches of styleSwitches) {
          for (const suppliedProof of [false, true]) {
            const context = await fixture.context();
            if (!suppliedProof) {
              const factory = context.links!;
              context.links = (base, head) => {
                const links = factory(base, head);
                return { before: links.before, after: links.after };
              };
            }
            const actual = await compareComponentView(
              { ...context, ...switches },
              before,
              after,
            );
            assert.deepEqual(
              result(actual),
              result(oracle),
              JSON.stringify({ switches, suppliedProof }),
            );
          }
        }
      }
    });

for (const styleEdit of [false, true])
  test(`stable link maps keep shortcuts without another source rewrite: style=${styleEdit}`, async (t) => {
    const fixture = await moveLinkShortcutFixture(
      t,
      "committed",
      styleEdit,
      false,
    );
    const context = await fixture.context();
    const links = context.links!;
    context.links = (before, after) => ({
      ...links(before, after),
      before: () => assert.fail("shortcut must not add a source rewrite"),
      after: () => assert.fail("shortcut must not add a source rewrite"),
    });
    const actual = await compareComponentView(
      { ...context, useFastPath: !styleEdit },
      fixture.beforeViews[0],
      fixture.afterViews[0],
    );
    assert.equal(actual.comparisonPath, styleEdit ? "style" : "fast");
    assert.equal(actual.view.state, "unchanged");
  });

function result({ comparisonPath: _path, ...value }: ComparedComponentView) {
  return value;
}
