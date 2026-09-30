import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { ComparisonToolbar } from "../src/shell/comparison_toolbar.js";
import type { ComparisonMode } from "../src/shell/use_comparison.js";

function band(
  mode: ComparisonMode,
  options: { loaded?: boolean; together?: boolean } = {},
): string {
  return renderToStaticMarkup(
    <ComparisonToolbar
      current={mode === "current"}
      eligible
      loaded={options.loaded ?? true}
      mode={mode}
      onMode={() => undefined}
      onRefresh={() => undefined}
      onTogether={() => undefined}
      together={options.together ?? true}
    />,
  );
}

const SWITCH =
  /<label class="mbk-diff-sync"( hidden="")?><input data-diff-scroll-together="" role="switch" type="checkbox"( checked="")?\/><span aria-hidden="true" class="mbk-diff-sync-track"><\/span>Scroll together<\/label>/;

test("Scroll together sits between the modes and Refresh in every diff mode", () => {
  for (const mode of ["side", "overlay", "difference"] as const) {
    const markup = band(mode);
    const match = SWITCH.exec(markup);
    assert.ok(match, mode);
    assert.equal(match[1], undefined, `${mode}: shown`);
    assert.equal(match[2], ' checked=""', `${mode}: on`);
    assert.ok(markup.indexOf("mbk-seg") < markup.indexOf("mbk-diff-sync"));
    assert.ok(
      markup.indexOf("mbk-diff-sync") < markup.indexOf("mbk-diff-refresh"),
    );
  }
});

test("Scroll together shows off, and stays while a comparison loads", () => {
  assert.equal(
    SWITCH.exec(band("overlay", { together: false }))![2],
    undefined,
  );
  const loading = band("side", { loaded: false });
  assert.equal(SWITCH.exec(loading)![1], undefined);
  assert.match(
    loading,
    /class="mbk-diff-refresh" data-diff-refresh="" hidden=""/,
  );
});

test("Current hides Scroll together", () => {
  assert.equal(SWITCH.exec(band("current"))![1], ' hidden=""');
});
