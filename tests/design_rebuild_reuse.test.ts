import assert from "node:assert/strict";
import test from "node:test";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { previewMode, segments } from "./helpers/design_interactive.js";
import { REBUILD_STATES } from "./helpers/design_rebuild_status.js";
import { declaration, designStyleRules } from "./helpers/design_styles.js";

/** Every link destination in a region, in document order. */
function destinations(region: Parameters<typeof elements>[0]): string[] {
  return elements(region, (node) => node.tagName === "a").map(
    (node) => attribute(node, "data-mokly-link") ?? "",
  );
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: each state keeps an existing workspace and its canonical controls`, async () => {
    for (const state of REBUILD_STATES) {
      const own = (await designDocument(state.id, viewport)).document;
      const workspace = (await designDocument(state.workspace, viewport))
        .document;
      const navigation = (await designDocument(state.navigation, viewport))
        .document;
      const main = (document: typeof own) => byClass(document, "mbk-main")[0]!;
      assert.equal(
        textContent(main(own)),
        textContent(main(workspace)),
        state.id,
      );
      const mode = previewMode(own);
      const canonical = previewMode(navigation);
      assert.ok(mode && canonical, state.id);
      assert.deepEqual(segments(mode), segments(canonical), state.id);
      assert.deepEqual(
        destinations(byClass(own, "mbk-topbar")[0]!),
        destinations(byClass(navigation, "mbk-topbar")[0]!),
        `${state.id}: the top bar keeps its canonical links`,
      );
    }
  });

  test(`${viewport}: Static and Live show the same notice`, async () => {
    const still = (await designDocument("design-rebuild-failure", viewport))
      .document;
    const live = (
      await designDocument("design-rebuild-live-component", viewport)
    ).document;
    const notice = (document: typeof still) =>
      textContent(byClass(document, "mbk-rebuild")[0]!);
    assert.equal(notice(still), notice(live));
    assert.deepEqual(
      segments(previewMode(still)!).map(([label, selected]) => [
        label,
        selected,
      ]),
      [
        ["Static", true],
        ["Live", false],
      ],
    );
    assert.deepEqual(
      segments(previewMode(live)!).map(([label, selected]) => [
        label,
        selected,
      ]),
      [
        ["Static", false],
        ["Live", true],
      ],
    );
  });
}

test("the notice and top bar are the shared components in every state", async () => {
  const { manifest } = await designCatalogue;
  for (const state of REBUILD_STATES) {
    const entry = manifest.entries.find((entry) => entry.id === state.id);
    assert.ok(entry?.kind === "screen" && entry.componentViews, state.id);
    for (const view of entry.componentViews) {
      const ids = view.instances.map((instance) => instance.componentId);
      assert.ok(ids.includes("design-ui-top-bar"), state.id);
      assert.equal(
        ids.filter((id) => id === "design-ui-rebuild-notice").length,
        state.notice ? 1 : 0,
        `${state.id}/${view.viewport}`,
      );
    }
  }
});

test("the notice and progress draw no edge accent", async () => {
  const rules = (await designStyleRules()).filter(
    (rule) =>
      rule.file === "design-library/chrome/rebuild-notice.css" ||
      /mbk-progress|mbk-search-slot/u.test(rule.selector),
  );
  assert.ok(rules.some((rule) => rule.selector === ".mbk-rebuild-card"));
  for (const rule of rules)
    assert.doesNotMatch(
      `${rule.selector}{${rule.body}}`,
      /border-(?:left|right|inline)|box-shadow[^;]*inset|::?(?:before|after)|gradient\(/u,
      `${rule.file} ${rule.selector}`,
    );
  const card = rules.find((rule) => rule.selector === ".mbk-rebuild-card")!;
  assert.equal(
    declaration(card.body, "border"),
    "1px solid var(--mbk-danger-edge)",
    "one complete outline",
  );
});
