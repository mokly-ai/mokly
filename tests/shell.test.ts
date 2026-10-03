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
  context,
  darkManifest,
  embeddedPage,
  hasClass,
  manifest,
  occurrences,
  requiredElement,
  routePage,
  viewPage,
  workspaceFrame,
} from "./helpers/shell_fixture.js";

test("screen page renders device chrome, viewport switch, and details", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byId.get("welcome");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeId: "welcome",
  });
  assert.match(
    html,
    /class="mbk-frag"[^>]*sandbox="allow-same-origin"[^>]*welcome\.mobile/,
  );
  assert.match(
    html,
    /class="mbk-frag"[^>]*sandbox="allow-same-origin"[^>]*welcome\.desktop/,
  );
  assert.match(html, /class="phone-frame"/);
  assert.equal(html.match(/class="phone-frame"/g)?.length, 1);
  assert.match(html, /class="phone-notch"/);
  assert.match(
    html,
    /class="phone-status"><span>9:41<\/span><span class="phone-status-icons">(<svg[\s\S]*?<\/svg>){3}<\/span><\/div><iframe/,
  );
  assert.match(html, /class="browser-frame"/);
  assert.equal(html.match(/class="browser-frame"/g)?.length, 1);
  assert.match(html, /class="browser-expand"/);
  assert.match(html, /class="address-url">example\.test\/welcome</);
  assert.match(html, /data-mokly-stage="" data-viewport="both"/);
  assert.match(html, /<option value="mobile">Mobile<\/option>/);
  assert.match(html, /aria-label="Viewport" data-workspace-viewport=""/);
  assert.equal(html.includes('class="mbk-viewbar"'), false);
  assert.match(html, /class="mbk-crumbs"/);
  const idButton = requiredElement(
    html,
    (element) => attribute(element, "data-copy-id") === "welcome",
  );
  assertAttributes(idButton, {
    "aria-label": "Copy ID welcome",
    class: "mbk-idchip",
    href: undefined,
    type: "button",
  });
  assert.equal(textContent(idButton), "#welcome");
  assert.match(html, /Proves the shell/);
  assert.match(html, /notes\.md/);
  const inspector = requiredElement(
    html,
    (element) => attribute(element, "data-workspace-inspector") !== undefined,
  );
  assert.equal(inspector.tagName, "section");
  assert.equal(hasClass(inspector, "mbk-inspector"), true);
  requiredElement(
    html,
    (element) =>
      attribute(element, "role") === "tab" &&
      attribute(element, "aria-label") === "Details",
  );
  requiredElement(
    html,
    (element) =>
      hasClass(element, "mbk-chip") &&
      hasClass(element, "flow") &&
      attribute(element, "href") === "/view/user-flows/tour.html",
  );
  assert.match(html, /aria-live="polite"/);
});

test("use-case page renders the flow with catalogue links per step", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byId.get("tour");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, context);
  const welcomeLink = requiredElement(
    html,
    (element) =>
      hasClass(element, "flow-step-link") &&
      attribute(element, "href") === "/view/screens/welcome.html",
  );
  assert.equal(
    textContent(welcomeLink),
    "This screen in the catalogue: Welcome →",
  );
  assert.match(html, /class="flow-step-num"/);
  assert.match(html, /class="mbk-flow-screen"/);
});

test("embedded preview switches render only for catalogues with dark fragments", () => {
  const lightOnly = createCatalogue(manifest);
  assert.equal(lightOnly.hasDarkFragments, false);
  assert.equal(
    embeddedPage(lightOnly, null).includes("data-mokly-schemeswitch"),
    false,
  );
  assert.equal(
    embeddedPage(lightOnly, "welcome").includes("data-mokly-schemeswitch"),
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

  const screen = embeddedPage(dark, "welcome");
  assert.equal(occurrences(screen, "data-mokly-schemeswitch"), 1);
  assert.equal(occurrences(screen, "data-workspace-scheme"), 1);
  assert.match(screen, /aria-label="Dark preview"/);
  assert.match(
    screen,
    /class="mbk-view-tools"[\s\S]*?data-workspace-viewport=""[\s\S]*?data-workspace-scheme=""/,
  );

  const flow = embeddedPage(dark, "tour");
  assert.equal(occurrences(flow, "data-mokly-schemeswitch"), 2);
  assert.equal(flow.includes("data-mokly-viewswitch"), false);
  assert.match(
    flow,
    /<\/div><span aria-label="Preview color scheme"[\s\S]*?<\/span><\/div><div class="mbk-flow"/,
  );

  const legacy = embeddedPage(dark, "old");
  assert.equal(occurrences(legacy, "data-mokly-schemeswitch"), 1);
});

test("screen stage carries per-frame scheme fragment data", () => {
  const dark = createCatalogue(darkManifest);
  const screen = routePage(dark, "screens/welcome.html");
  for (const viewport of ["mobile", "desktop"]) {
    const suffix = `welcome.${viewport}`;
    assertAttributes(workspaceFrame(screen, viewport), {
      class: "mbk-frag",
      "data-fragment-dark": `/static/screens/${suffix}.dark.html`,
      "data-fragment-light": `/static/screens/${suffix}.html`,
      "data-mokly-fragment-frame": "",
      sandbox: "allow-same-origin",
      src: `/static/screens/${suffix}.html`,
      title: `Welcome — ${viewport}`,
    });
  }
  assert.equal(screen.includes("data-color-scheme-fallback"), false);
  assert.equal(screen.includes("mbk-frame-scheme-note"), false);
  assertLightSrcMatchesAttribute(screen, 2);

  const fallback = routePage(dark, "screens/details.html");
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
    "data-fragment-light": "/static/screens/details.mobile.html",
    "data-mokly-fragment-frame": "",
    sandbox: "allow-same-origin",
    src: "/static/screens/details.mobile.html",
    title: "Details — mobile",
  });
  assert.equal(fallback.includes("data-fragment-dark"), false);
  assertLightSrcMatchesAttribute(fallback, 2);

  const flow = routePage(dark, "user-flows/tour.html");
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
    "data-fragment-dark": "/static/screens/welcome.desktop.dark.html",
    "data-fragment-light": "/static/screens/welcome.desktop.html",
    "data-mokly-fragment-frame": "",
    sandbox: "allow-same-origin",
    src: "/static/screens/welcome.desktop.html",
  });
  assertAttributes(flowFrames[1]!, {
    "data-fragment-dark": undefined,
    "data-fragment-light": "/static/screens/details.desktop.html",
    "data-mokly-fragment-frame": undefined,
    sandbox: "allow-same-origin",
    src: "/static/screens/details.desktop.html",
  });
  assert.equal(flow.includes("mbk-frame-scheme-note"), false);
  assertLightSrcMatchesAttribute(flow, 2);

  const lightOnly = createCatalogue(manifest);
  const lightScreen = routePage(lightOnly, "screens/welcome.html");
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
    src: "/static/screens/welcome.mobile.html",
    title: "Welcome — mobile",
  });
  assert.equal(lightScreen.includes("data-fragment-"), false);
  assert.equal(lightScreen.includes("data-color-scheme-fallback"), false);
  const lightFlow = routePage(lightOnly, "user-flows/tour.html");
  assert.match(
    lightFlow,
    /<div class="mbk-flow-screen" data-preview-color-scheme="light"><div class="browser-frame">/,
  );
  assert.equal(lightFlow.includes("data-fragment-"), false);
});
