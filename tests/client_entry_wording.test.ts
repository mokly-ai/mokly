import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPONENT_STYLE_COPY,
  PAGE_STYLE_COPY,
  SCREEN_STYLE_COPY,
} from "../examples/basic/specs/design/parts/stylesheet_evidence.js";
import { entryWording } from "../packages/viewer/dist/shell/entry_wording.js";

test("entry wording keeps screen copy and recasts it for a variant", () => {
  const screen = entryWording("screen");
  assert.equal(
    screen.label("Styles this screen uses changed"),
    "Styles this screen uses changed",
  );
  assert.equal(screen.label("Screen changed"), "Screen changed");
  assert.equal(screen.noChanges, "No changes to this screen.");
  assert.equal(
    screen.sharedImpact,
    "Changed components that this screen uses affect its preview.",
  );

  const component = entryWording("component");
  assert.equal(
    component.label("Styles this screen uses changed"),
    "Styles this variant uses changed",
  );
  assert.equal(component.label("Screen changed"), "Variant changed");
  assert.equal(component.noChanges, "No changes to this variant.");
  assert.equal(
    component.sharedImpact,
    "Changed components that this variant uses affect its preview.",
  );
});

test("a component recasts each stage label for its variant", () => {
  const component = entryWording("component");
  for (const [screen, variant] of [
    ["Screen changed", "Variant changed"],
    ["No changes to this screen", "No changes to this variant"],
    ["New screen", "New variant"],
    ["Screen removed", "Variant removed"],
    ["Only excluded content changed", "Only excluded content changed"],
  ] as const)
    assert.equal(component.label(screen), variant);
});

test("each entry kind's copy matches the shared design copy", () => {
  const screen = entryWording("screen");
  assert.deepEqual(
    [
      screen.filesLead,
      screen.matchedStylesWithSelectors,
      screen.pageOutsideStyles,
      screen.unresolvedStylesWithSelectors,
      screen.unresolvedStylesWithoutSelectors,
      screen.excludedStylesheet,
      screen.noChanges,
      screen.stylesChanged,
      screen.componentsChanged,
      screen.sharedImpact,
    ],
    [
      SCREEN_STYLE_COPY.files,
      SCREEN_STYLE_COPY.matched,
      SCREEN_STYLE_COPY.outside,
      SCREEN_STYLE_COPY.unresolved,
      SCREEN_STYLE_COPY.unnamed,
      SCREEN_STYLE_COPY.excluded,
      SCREEN_STYLE_COPY.noChanges,
      SCREEN_STYLE_COPY.stylesChanged,
      SCREEN_STYLE_COPY.componentsChanged,
      SCREEN_STYLE_COPY.sharedImpact,
    ],
  );
  const component = entryWording("component");
  assert.deepEqual(
    [
      component.filesLead,
      component.matchedStylesWithSelectors,
      component.excludedStylesheet,
      component.noChanges,
      component.stylesChanged,
      component.componentsChanged,
      component.sharedImpact,
    ],
    [
      COMPONENT_STYLE_COPY.files,
      COMPONENT_STYLE_COPY.matched,
      COMPONENT_STYLE_COPY.excluded,
      COMPONENT_STYLE_COPY.noChanges,
      COMPONENT_STYLE_COPY.stylesChanged,
      COMPONENT_STYLE_COPY.componentsChanged,
      COMPONENT_STYLE_COPY.sharedImpact,
    ],
  );
  const page = entryWording("page");
  assert.deepEqual(
    [
      page.filesLead,
      page.matchedStylesWithSelectors,
      page.pageOutsideStyles,
      page.unresolvedStylesWithSelectors,
    ],
    [
      PAGE_STYLE_COPY.files,
      PAGE_STYLE_COPY.matched,
      PAGE_STYLE_COPY.outside,
      PAGE_STYLE_COPY.unresolved,
    ],
  );
  // A page uses no components, so neither copy gives it that sentence.
  assert.ok(!("sharedImpact" in page) && !("sharedImpact" in PAGE_STYLE_COPY));
});
