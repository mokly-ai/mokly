import assert from "node:assert/strict";
import test from "node:test";

import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";

import { detailsSection, tagsRow } from "./helpers/shell_assertions.js";
import {
  darkManifest,
  manifest,
  routePage,
  taggedFlowManifest,
  untaggedManifest,
} from "./helpers/shell_fixture.js";

test("details inspector omits derived paths and lists the schemes row", () => {
  const dark = createCatalogue(darkManifest);
  const screen = routePage(dark, "example/screens/welcome/index.html");
  assert.match(
    screen,
    /<div class="mbk-meta-row"><span class="mbk-meta-k">Schemes<\/span><span class="mbk-meta-v">light, dark<\/span><\/div>/,
  );
  assert.equal(screen.includes('mbk-meta-k">Generated'), false);

  const fallback = routePage(dark, "example/screens/details/index.html");
  assert.match(
    fallback,
    /<div class="mbk-meta-row"><span class="mbk-meta-k">Schemes<\/span><span class="mbk-meta-v">light<\/span><\/div>/,
  );
  assert.equal(fallback.includes('mbk-meta-k">Generated'), false);

  const flow = routePage(dark, "example/tour/index.html");
  assert.equal(flow.includes('mbk-meta-k">Schemes'), false);

  const lightOnly = createCatalogue(manifest);
  const lightScreen = routePage(
    lightOnly,
    "example/screens/welcome/index.html",
  );
  assert.equal(lightScreen.includes('mbk-meta-k">Schemes'), false);
  assert.equal(lightScreen.includes('mbk-meta-k">Generated'), false);
  const page = routePage(lightOnly, "example/overview/index.html");
  assert.equal(page.includes('mbk-meta-k">Generated'), false);
});

test("details inspector chips the tags an entry declares", () => {
  const dark = createCatalogue(darkManifest);
  const welcome = routePage(dark, "example/screens/welcome/index.html");
  assert.ok(welcome.includes(tagsRow("forms", "onboarding")));
  assert.ok(
    welcome.includes(
      '<div class="mbk-meta-row"><span class="mbk-meta-k">Related docs</span>',
    ),
  );

  const second = detailsSection(
    routePage(dark, "example/screens/details/index.html"),
  );
  assert.ok(second.includes(tagsRow("billing")));

  const untagged = detailsSection(routePage(dark, "example/tour/index.html"));
  assert.equal(untagged.includes('mbk-meta-k">Tags'), false);
  assert.equal(untagged.includes("data-mokly-tag"), false);
});

test("a use case chips its tags in the same details row", () => {
  const flow = routePage(
    createCatalogue(taggedFlowManifest),
    "example/tour/index.html",
  );
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
