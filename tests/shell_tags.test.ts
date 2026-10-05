import assert from "node:assert/strict";
import test from "node:test";

import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";

import {
  attribute,
  documentElements,
  elements,
  textContent,
} from "./helpers/html.js";
import {
  assertAttributes,
  detailsSection,
  requiredElement,
  tagsRow,
} from "./helpers/shell_assertions.js";
import {
  context,
  darkManifest,
  homePage,
  manifest,
  routePage,
  taggedFlowManifest,
  untaggedManifest,
} from "./helpers/shell_fixture.js";

test("details inspector omits derived paths and lists the schemes row", () => {
  const dark = createCatalogue(darkManifest);
  const screen = routePage(dark, "example/screens/welcome/");
  assert.match(
    screen,
    /<div class="mbk-meta-row"><span class="mbk-meta-k">Schemes<\/span><span class="mbk-meta-v">light, dark<\/span><\/div>/,
  );
  assert.equal(screen.includes('mbk-meta-k">Generated'), false);

  const fallback = routePage(dark, "example/screens/details/");
  assert.match(
    fallback,
    /<div class="mbk-meta-row"><span class="mbk-meta-k">Schemes<\/span><span class="mbk-meta-v">light<\/span><\/div>/,
  );
  assert.equal(fallback.includes('mbk-meta-k">Generated'), false);

  const flow = routePage(dark, "example/tour/");
  assert.equal(flow.includes('mbk-meta-k">Schemes'), false);

  const lightOnly = createCatalogue(manifest);
  const lightScreen = routePage(lightOnly, "example/screens/welcome/");
  assert.equal(lightScreen.includes('mbk-meta-k">Schemes'), false);
  assert.equal(lightScreen.includes('mbk-meta-k">Generated'), false);
  const page = routePage(lightOnly, "example/overview/");
  assert.equal(page.includes('mbk-meta-k">Generated'), false);
});

test("details inspector chips the tags an entry declares", () => {
  const dark = createCatalogue(darkManifest);
  const welcome = routePage(dark, "example/screens/welcome/");
  assert.ok(welcome.includes(tagsRow("forms", "onboarding")));
  assert.ok(
    welcome.includes(
      '<div class="mbk-meta-row"><span class="mbk-meta-k">Related docs</span>',
    ),
  );

  const second = detailsSection(routePage(dark, "example/screens/details/"));
  assert.ok(second.includes(tagsRow("billing")));

  const untagged = detailsSection(routePage(dark, "example/tour/"));
  assert.equal(untagged.includes('mbk-meta-k">Tags'), false);
  assert.equal(untagged.includes("data-mokly-tag"), false);
});

test("a use case chips its tags in the same details row", () => {
  const flow = routePage(createCatalogue(taggedFlowManifest), "example/tour/");
  assert.ok(
    flow.includes(
      '<code class="mbk-code">entries/fixture.mockup.tsx</code></span></div>' +
        tagsRow("onboarding", "walkthrough"),
    ),
  );
  assert.equal(flow.includes('mbk-meta-k">Generated'), false);
});

test("the catalogue names every declared tag once, in sorted order", () => {
  assert.deepEqual(createCatalogue(manifest).tags, [
    "billing",
    "forms",
    "onboarding",
  ]);
  assert.deepEqual(createCatalogue(taggedFlowManifest).tags, [
    "billing",
    "forms",
    "onboarding",
    "walkthrough",
  ]);
  assert.deepEqual(createCatalogue(untaggedManifest).tags, []);
});

test("the search field carries a tag control over a closed picker", () => {
  const html = homePage(createCatalogue(manifest), context);
  const search = requiredElement(
    html,
    (element) => attribute(element, "data-mokly-search") !== undefined,
  );
  assertAttributes(search, {
    "aria-label": "Search catalogue",
    placeholder: "Search catalogue…",
    type: "search",
    value: "",
  });
  const toggle = requiredElement(
    html,
    (element) => attribute(element, "data-mokly-tag-toggle") !== undefined,
  );
  assertAttributes(toggle, {
    "aria-controls": "mb-tag-picker",
    "aria-expanded": "false",
    "aria-label": "Filter by tag",
    type: "button",
  });
  const picker = requiredElement(
    html,
    (element) => attribute(element, "data-mokly-tag-picker") !== undefined,
  );
  assertAttributes(picker, {
    "aria-label": "Tags",
    hidden: "",
    id: "mb-tag-picker",
    role: "group",
  });
  const tags = elements(
    picker,
    (element) => attribute(element, "data-mokly-tag") !== undefined,
  );
  assert.deepEqual(
    tags.map((tag) => ({
      pressed: attribute(tag, "aria-pressed"),
      tabIndex: attribute(tag, "tabindex"),
      tag: attribute(tag, "data-mokly-tag"),
      text: textContent(tag),
    })),
    [
      { pressed: "false", tabIndex: "0", tag: "billing", text: "billing" },
      { pressed: "false", tabIndex: "-1", tag: "forms", text: "forms" },
      {
        pressed: "false",
        tabIndex: "-1",
        tag: "onboarding",
        text: "onboarding",
      },
    ],
  );

  const untagged = homePage(createCatalogue(untaggedManifest), context);
  assert.equal(
    documentElements(
      untagged,
      (element) => attribute(element, "data-mokly-search") !== undefined,
    ).length,
    1,
  );
  assert.equal(
    documentElements(
      untagged,
      (element) =>
        attribute(element, "data-mokly-tag-toggle") !== undefined ||
        attribute(element, "data-mokly-tag-picker") !== undefined,
    ).length,
    0,
  );
});
