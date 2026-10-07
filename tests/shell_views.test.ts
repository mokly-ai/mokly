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
  SCHEME_SWITCH,
  assertAttributes,
  assertLightSrcMatchesAttribute,
  detailsSection,
  hasClass,
  occurrences,
  requiredElement,
  tagsRow,
  workspaceFrame,
} from "./helpers/shell_assertions.js";
import {
  darkManifest,
  embeddedPage,
  manifest,
  routePage,
  taggedFlowManifest,
} from "./helpers/shell_fixture.js";

test("embedded preview switches render only for catalogues with dark fragments", () => {
  const lightOnly = createCatalogue(manifest);
  assert.equal(lightOnly.hasDarkFragments, false);
  assert.equal(
    embeddedPage(lightOnly, null).includes("data-mokly-schemeswitch"),
    false,
  );
  assert.equal(
    embeddedPage(lightOnly, "example/screens/welcome").includes(
      "data-mokly-schemeswitch",
    ),
    false,
  );

  const dark = createCatalogue(darkManifest);
  assert.equal(dark.hasDarkFragments, true);
  const home = embeddedPage(dark, null);
  assert.ok(home.includes(SCHEME_SWITCH));
  assert.equal(occurrences(home, "data-mokly-schemeswitch"), 1);
  assert.match(
    home,
    /data-mokly-search[\s\S]*?class="mbk-search-close"[\s\S]*?<\/button><span aria-label="Preview color scheme"[\s\S]*?<\/span><\/header>/,
  );

  const screen = embeddedPage(dark, "example/screens/welcome");
  assert.equal(occurrences(screen, "data-mokly-schemeswitch"), 1);
  assert.equal(occurrences(screen, "data-workspace-scheme"), 1);
  assert.match(screen, /aria-label="Dark preview"/);
  assert.match(
    screen,
    /class="mbk-view-tools"[\s\S]*?data-workspace-viewport=""[\s\S]*?data-workspace-scheme=""/,
  );

  const flow = embeddedPage(dark, "example/tour");
  assert.equal(occurrences(flow, "data-mokly-schemeswitch"), 2);
  assert.equal(flow.includes("data-mokly-viewswitch"), false);
  assert.match(
    flow,
    /<\/div><span aria-label="Preview color scheme"[\s\S]*?<\/span><\/div><div class="mbk-flow"/,
  );

  const legacy = embeddedPage(dark, "example/old");
  assert.equal(occurrences(legacy, "data-mokly-schemeswitch"), 1);
});

test("screen stage carries per-frame scheme fragment data", () => {
  const dark = createCatalogue(darkManifest);
  const screen = routePage(dark, "example/screens/welcome/index.html");
  for (const viewport of ["mobile", "desktop"]) {
    const suffix = `example/screens/welcome/index.${viewport}`;
    assertAttributes(workspaceFrame(screen, viewport), {
      class: "mbk-frag",
      "data-fragment-dark": `/static/mokly-generated/${suffix}.dark.html`,
      "data-fragment-light": `/static/mokly-generated/${suffix}.html`,
      "data-mokly-fragment-frame": "",
      sandbox: "allow-same-origin",
      src: `/static/mokly-generated/${suffix}.html`,
      title: `Welcome — ${viewport}`,
    });
  }
  assert.equal(screen.includes("data-color-scheme-fallback"), false);
  assert.equal(screen.includes("mbk-frame-scheme-note"), false);
  assertLightSrcMatchesAttribute(screen, 2);

  const fallback = routePage(dark, "example/screens/details/index.html");
  assert.match(
    fallback,
    /<div class="mbk-frame-wrap mbk-frame-mobile" data-color-scheme-fallback="" data-preview-color-scheme="light"><p class="mbk-frame-label">Mobile<span class="mbk-frame-scheme-note"> — Light only<\/span><\/p>/,
  );
  assert.match(
    fallback,
    /<div class="mbk-frame-wrap mbk-frame-desktop" data-color-scheme-fallback="" data-preview-color-scheme="light"><p class="mbk-frame-label">Desktop<span class="mbk-frame-scheme-note"> — Light only<\/span><\/p>/,
  );
  assertAttributes(workspaceFrame(fallback, "mobile"), {
    class: "mbk-frag",
    "data-fragment-dark": undefined,
    "data-fragment-light":
      "/static/mokly-generated/example/screens/details/index.mobile.html",
    "data-mokly-fragment-frame": "",
    sandbox: "allow-same-origin",
    src: "/static/mokly-generated/example/screens/details/index.mobile.html",
    title: "Details — mobile",
  });
  assert.equal(fallback.includes("data-fragment-dark"), false);
  assertLightSrcMatchesAttribute(fallback, 2);

  const flow = routePage(dark, "example/tour/index.html");
  const flowScreens = documentElements(flow, (element) =>
    hasClass(element, "mbk-flow-screen"),
  );
  assert.equal(flowScreens.length, 2);
  assert.equal(
    attribute(flowScreens[0]!, "data-color-scheme-fallback"),
    undefined,
  );
  assert.equal(attribute(flowScreens[1]!, "data-color-scheme-fallback"), "");
  const flowFrames = flowScreens.map(
    (wrapper) =>
      elements(wrapper, (element) => element.tagName === "iframe")[0]!,
  );
  assertAttributes(flowFrames[0]!, {
    "data-fragment-dark":
      "/static/mokly-generated/example/screens/welcome/index.desktop.dark.html",
    "data-fragment-light":
      "/static/mokly-generated/example/screens/welcome/index.desktop.html",
    "data-mokly-fragment-frame": "",
    sandbox: "allow-same-origin",
    src: "/static/mokly-generated/example/screens/welcome/index.desktop.html",
  });
  assertAttributes(flowFrames[1]!, {
    "data-fragment-dark": undefined,
    "data-fragment-light":
      "/static/mokly-generated/example/screens/details/index.desktop.html",
    "data-mokly-fragment-frame": undefined,
    sandbox: "allow-same-origin",
    src: "/static/mokly-generated/example/screens/details/index.desktop.html",
  });
  assert.equal(flow.includes("mbk-frame-scheme-note"), false);
  assertLightSrcMatchesAttribute(flow, 2);

  const lightOnly = createCatalogue(manifest);
  const lightScreen = routePage(
    lightOnly,
    "example/screens/welcome/index.html",
  );
  const lightMobile = requiredElement(lightScreen, (element) =>
    hasClass(element, "mbk-frame-mobile"),
  );
  const lightLabel = elements(
    lightMobile,
    (element) =>
      element.tagName === "p" && hasClass(element, "mbk-frame-label"),
  );
  assert.equal(lightLabel.length, 1);
  assert.equal(textContent(lightLabel[0]!), "Mobile");
  assert.equal(attribute(lightMobile, "data-color-scheme-fallback"), undefined);
  assertAttributes(workspaceFrame(lightScreen, "mobile"), {
    class: "mbk-frag",
    "data-fragment-dark": undefined,
    "data-fragment-light": undefined,
    "data-mokly-fragment-frame": "",
    sandbox: "allow-same-origin",
    src: "/static/mokly-generated/example/screens/welcome/index.mobile.html",
    title: "Welcome — mobile",
  });
  assert.equal(lightScreen.includes("data-fragment-"), false);
  assert.equal(lightScreen.includes("data-color-scheme-fallback"), false);
  const lightFlow = routePage(lightOnly, "example/tour/index.html");
  assert.match(
    lightFlow,
    /<div class="mbk-flow-screen" data-preview-color-scheme="light"><div class="browser-frame">/,
  );
  assert.equal(lightFlow.includes("data-fragment-"), false);
});

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
