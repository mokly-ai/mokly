import assert from "node:assert/strict";
import test from "node:test";

import { homePage, notFoundPage, viewPage } from "../dist/server/pages.js";
import type { ManifestV5 } from "../packages/viewer/dist/registry/types.js";
import type { Catalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { SHELL_CSS } from "../packages/viewer/dist/shell/css.js";
import { buildNavTree } from "../packages/viewer/dist/shell/nav_tree.js";

const manifest: ManifestV5 = {
  entries: [
    {
      kind: "page",
      id: "old",
      title: "Old",
      description: "Original complete document",
      route: "legacy/old.html",
      sourcePath: "entries/fixture.mockup.tsx",
      declaredDependencies: [],
      dependencies: [],
      relatedDocs: [],
      navPath: [],
    },
    {
      kind: "page",
      id: "overview",
      title: "Overview",
      description: "Catalogue overview",
      route: "legacy/index.html",
      sourcePath: "entries/fixture.mockup.tsx",
      declaredDependencies: [],
      dependencies: [],
      relatedDocs: [],
      navPath: [],
    },
    {
      childIds: ["screens", "tour", "old", "overview"],
      declaredDependencies: [],
      dependencies: [],
      description: "Example catalogue",
      id: "example",
      kind: "collection",
      navPath: [],
      relatedDocs: [],
      sourcePath: "entries/fixture.mockup.tsx",
      title: "Example",
    },
    {
      childIds: ["welcome", "details"],
      declaredDependencies: [],
      dependencies: [],
      description: "Screens",
      id: "screens",
      kind: "collection",
      navPath: ["Example"],
      relatedDocs: [],
      sourcePath: "entries/fixture.mockup.tsx",
      title: "Screens",
    },
    {
      address: "example.test/welcome",
      declaredDependencies: [],
      dependencies: ["styles.css"],
      description: "Landing screen",
      fragments: {
        desktop: "screens/welcome.desktop.html",
        mobile: "screens/welcome.mobile.html",
      },
      id: "welcome",
      kind: "screen",
      navPath: ["Example", "Screens"],
      rationale: "Proves the shell",
      relatedDocs: ["notes.md"],
      route: "screens/welcome.html",
      sourcePath: "entries/fixture.mockup.tsx",
      tags: ["forms", "onboarding"],
      title: "Welcome",
      useCaseIds: ["tour"],
      viewports: ["mobile", "desktop"],
    },
    {
      declaredDependencies: [],
      dependencies: [],
      description: "Second screen",
      fragments: {
        desktop: "screens/details.desktop.html",
        mobile: "screens/details.mobile.html",
      },
      id: "details",
      kind: "screen",
      navPath: ["Example", "Screens"],
      relatedDocs: [],
      route: "screens/details.html",
      sourcePath: "entries/fixture.mockup.tsx",
      tags: ["billing"],
      title: "Details",
      useCaseIds: ["tour"],
      viewports: ["mobile", "desktop"],
    },
    {
      declaredDependencies: [],
      dependencies: [],
      description: "Ordered journey",
      id: "tour",
      kind: "use-case",
      navPath: ["Example"],
      relatedDocs: [],
      route: "user-flows/tour.html",
      sourcePath: "entries/fixture.mockup.tsx",
      steps: [{ screenId: "welcome" }, { screenId: "details" }],
      title: "Tour",
    },
  ],
  generatedBy: "mokly",
  sourceFiles: ["entries/fixture.mockup.tsx"],
  schemaVersion: 5,
};

const darkManifest: ManifestV5 = {
  ...manifest,
  entries: manifest.entries.map((entry) =>
    entry.kind === "screen" && entry.id === "welcome"
      ? {
          ...entry,
          darkFragments: {
            desktop: "screens/welcome.desktop.dark.html",
            mobile: "screens/welcome.mobile.dark.html",
          },
        }
      : entry,
  ),
};

const taggedFlowManifest: ManifestV5 = {
  ...manifest,
  entries: manifest.entries.map((entry) =>
    entry.kind === "use-case"
      ? { ...entry, tags: ["onboarding", "walkthrough"] }
      : entry,
  ),
};

const untaggedManifest: ManifestV5 = {
  ...manifest,
  entries: manifest.entries.map((entry) => {
    if (entry.kind === "collection") return entry;
    const { tags: _tags, ...untagged } = entry;
    return untagged;
  }),
};

const context = {
  base: "origin/main",
  updateVersion: 1,
};

/** The shell's tag glyph at one rendered size. */
function tagIcon(size: number): string {
  return (
    `<svg aria-hidden="true" fill="none" height="${size}" stroke="currentColor" ` +
    'stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ' +
    `viewBox="0 0 24 24" width="${size}">` +
    '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7.4-7.4A2 2 0 0 1 2.6 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.6 7.6a2 2 0 0 1 0 2.8z"></path>' +
    '<path d="M7.6 7.6h.01"></path></svg>'
  );
}

/** One tag chip exactly as the approved mockup draws it, on either surface. */
function tagChip(tag: string): string {
  return (
    `<button aria-pressed="false" class="mbk-chip tag" ` +
    `data-mokly-tag="${tag}" type="button">${tagIcon(11)}${tag}</button>`
  );
}

/** The tag control the search field carries at its trailing edge. */
const TAG_TOGGLE =
  '<button aria-controls="mb-tag-picker" aria-expanded="false" ' +
  'aria-label="Filter by tag" class="mbk-search-tag" ' +
  `data-mokly-tag-toggle="" type="button">${tagIcon(13)}</button>`;

/** The panel the tag control drops under the search field, closed. */
function tagPicker(...tags: readonly string[]): string {
  return (
    '<div aria-label="Tags" class="mbk-tag-picker" hidden="" id="mb-tag-picker" ' +
    'role="group"><div class="mbk-tag-picker-head">Tags</div>' +
    '<span aria-label="Tag filters" class="mbk-chips" role="toolbar">' +
    tags.map(tagChip).join("") +
    "</span></div>"
  );
}

/** The metadata row wrapping one entry's tag chips. */
function tagsRow(...tags: readonly string[]): string {
  return (
    '<div class="mbk-meta-row"><span class="mbk-meta-k">Tags</span>' +
    '<span class="mbk-meta-v"><span class="mbk-chips">' +
    tags.map(tagChip).join("") +
    "</span></span></div>"
  );
}

const SCHEME_SWITCH =
  '<span aria-label="Color scheme" class="mbk-seg" data-mokly-schemeswitch="" role="group">' +
  '<button aria-pressed="true" data-color-scheme-option="light" type="button">Light</button>' +
  '<button aria-pressed="false" data-color-scheme-option="dark" type="button">Dark</button>' +
  "</span>";

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Collapse stylesheet whitespace so contract assertions pin selectors and
 * declarations rather than the source module's line wrapping.
 */
function flatCss(css: string): string {
  return css.replace(/\s+/g, " ").replace(/\(\s/g, "(").replace(/\s\)/g, ")");
}

/**
 * The selector of every declaration block that reads a dark screen token, used
 * to prove the dark palette cannot reach the light render.
 */
function darkTokenSelectors(css: string): string[] {
  return css
    .split("}")
    .filter((block) => block.includes("var(--mbk-dark-screen-"))
    .map((block) => block.slice(0, block.lastIndexOf("{")).trim());
}

/** The details inspector alone, so top-bar chips cannot satisfy a check. */
function detailsSection(html: string): string {
  const legacy = html.indexOf('<details class="mbk-details"');
  const start =
    legacy >= 0 ? legacy : html.indexOf('<section class="mbk-inspector"');
  assert.ok(start > -1);
  return html.slice(start);
}

function routePage(catalogue: Catalogue, route: string): string {
  const entry = catalogue.byRoute.get(route);
  assert.ok(entry);
  return viewPage(entry, catalogue, { ...context, activeRoute: route });
}

/**
 * Every scheme-aware frame serves its light fragment until the client swaps it,
 * so the rendered src must equal the light attribute the client assigns back.
 */
function assertLightSrcMatchesAttribute(html: string, frames: number): void {
  const matches = [
    ...html.matchAll(
      /<iframe [^>]*data-fragment-light="([^"]*)"[^>]*src="([^"]*)"[^>]*>/g,
    ),
  ];
  assert.equal(matches.length, frames);
  for (const match of matches) {
    assert.equal(match[2], match[1]);
  }
}

test("nav tree nests pages and screens in one declared hierarchy", () => {
  const catalogue = createCatalogue(manifest);
  const tree = buildNavTree(catalogue.hierarchy);
  const labels = tree.map((node) => node.label);
  assert.deepEqual(labels, ["Example"]);
  const example = tree[0];
  assert.ok(example?.kind === "group");
  const screens = example.children.find((node) => node.label === "Screens");
  assert.ok(screens?.kind === "group");
  assert.deepEqual(
    screens.children.map((node) => node.label),
    ["Details", "Welcome"],
  );
  const tour = example.children.find((node) => node.label === "Tour");
  assert.ok(tour?.kind === "leaf" && tour.entryKind === "use-case");
  assert.deepEqual(
    example.children
      .filter((node) => node.kind === "leaf" && node.entryKind === "page")
      .map((node) => node.label),
    ["Old", "Overview"],
  );
});

test("page breadcrumbs use real collections without invented Overview links", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byRoute.get("legacy/old.html");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeRoute: "legacy/old.html",
  });
  assert.match(
    html,
    /aria-label="Catalogue location" class="mbk-crumbs"><span>Example<\/span>/,
  );
  assert.match(html, /class="mbk-stage-embed"/);
});

test("catalogue nav marks active, changed, and iconed rows", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byRoute.get("screens/welcome.html");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeRoute: "screens/welcome.html",
    changedRoutes: ["screens/welcome.html"],
  });
  assert.match(
    html,
    /aria-current="page"[^>]*data-route="screens\/welcome\.html"/,
  );
  assert.match(html, /data-changed="true"/);
  assert.match(
    html,
    /data-entry-id="welcome"[^>]*data-route="screens\/welcome\.html"[^>]*data-tags="forms onboarding"/,
  );
  assert.match(
    html,
    /data-entry-id="details"[^>]*data-route="screens\/details\.html"[^>]*data-tags="billing"/,
  );
  assert.equal(
    /data-route="user-flows\/tour\.html"[^>]*data-tags/.test(html),
    false,
  );
  assert.match(
    html,
    /data-nav-disclosure="section:pages" data-nav-section="pages"/,
  );
  assert.doesNotMatch(html, /data-nav-section="components"/);
  assert.match(html, /data-nav-collection="collection:screens"/);
  assert.match(html, /data-nav-disclosure="collection:pages:screens"/);
  assert.match(html, /data-entry-kind="screen"/);
  assert.match(html, /class="mbk-nav-ico folder"><svg/);
  assert.match(html, /class="mbk-nav-count">2</);
  assert.match(html, /Collapse all/);
  assert.match(html, /data-mokly-nav-resize=""/);
  assert.match(
    html,
    /aria-label="Resize navigation panel"[^>]*aria-orientation="vertical"[^>]*role="separator"/,
  );
  const inactive = homePage(catalogue, context);
  assert.equal(inactive.includes('aria-current="page"[^>]*data-route'), false);
});

test("screen page renders device chrome, viewport switch, and details", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byRoute.get("screens/welcome.html");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeRoute: "screens/welcome.html",
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
  assert.match(html, /class="phone-notch"/);
  assert.match(
    html,
    /class="phone-status"><span>9:41<\/span><span class="phone-status-icons">(<svg[\s\S]*?<\/svg>){3}<\/span><\/div><iframe/,
  );
  assert.match(html, /class="browser-frame"/);
  assert.match(html, /class="browser-expand"/);
  assert.match(html, /class="address-url">example\.test\/welcome</);
  assert.match(html, /data-mokly-stage="" data-viewport="both"/);
  assert.match(html, /<option value="mobile">Mobile<\/option>/);
  assert.match(html, /aria-label="Viewport" data-workspace-viewport=""/);
  assert.equal(html.includes('class="mbk-viewbar"'), false);
  assert.match(html, /class="mbk-crumbs"/);
  assert.match(
    html,
    /aria-label="Copy ID welcome" class="mbk-idchip" data-copy-id="welcome" type="button">#welcome<\/button>/,
  );
  assert.doesNotMatch(html, /class="mbk-idchip"[^>]*href=/);
  assert.match(html, /Proves the shell/);
  assert.match(html, /notes\.md/);
  assert.match(
    html,
    /<section class="mbk-inspector" data-workspace-inspector=""/,
  );
  assert.match(html, /role="tab"[^>]*aria-label="Details"/);
  assert.match(
    html,
    /class="mbk-chip flow" href="\/view\/user-flows\/tour\.html"/,
  );
  assert.match(html, /aria-live="polite"/);
});

test("use-case page renders the flow with catalogue links per step", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byRoute.get("user-flows/tour.html");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, context);
  assert.match(html, /This screen in the catalogue: Welcome/);
  assert.match(html, /href="\/view\/screens\/welcome\.html"/);
  assert.match(html, /class="flow-step-num"/);
  assert.match(html, /class="mbk-flow-screen"/);
});

test("scheme switch renders only for catalogues with dark fragments", () => {
  const lightOnly = createCatalogue(manifest);
  assert.equal(lightOnly.hasDarkFragments, false);
  assert.equal(
    homePage(lightOnly, context).includes("data-mokly-schemeswitch"),
    false,
  );
  assert.equal(
    routePage(lightOnly, "screens/welcome.html").includes(
      "data-mokly-schemeswitch",
    ),
    false,
  );

  const dark = createCatalogue(darkManifest);
  assert.equal(dark.hasDarkFragments, true);
  const home = homePage(dark, context);
  assert.ok(home.includes(SCHEME_SWITCH));
  assert.equal(occurrences(home, "data-mokly-schemeswitch"), 1);
  assert.match(
    home,
    /data-mokly-search[\s\S]*?<\/div><span aria-label="Color scheme"[\s\S]*?<\/span><\/header>/,
  );

  const screen = routePage(dark, "screens/welcome.html");
  assert.equal(occurrences(screen, "data-mokly-schemeswitch"), 1);
  assert.equal(occurrences(screen, "data-workspace-scheme"), 1);
  assert.match(
    screen,
    /class="mbk-view-tools"[\s\S]*?data-workspace-viewport=""[\s\S]*?data-workspace-scheme=""/,
  );

  const flow = routePage(dark, "user-flows/tour.html");
  assert.equal(occurrences(flow, "data-mokly-schemeswitch"), 2);
  assert.equal(flow.includes("data-mokly-viewswitch"), false);
  assert.match(
    flow,
    /<\/div><span aria-label="Color scheme"[\s\S]*?<\/span><\/div><div class="mbk-flow"/,
  );

  const legacy = routePage(dark, "legacy/old.html");
  assert.equal(occurrences(legacy, "data-mokly-schemeswitch"), 1);
});

test("screen stage carries per-frame scheme fragment data", () => {
  const dark = createCatalogue(darkManifest);
  const screen = routePage(dark, "screens/welcome.html");
  assert.match(
    screen,
    /<iframe class="mbk-frag" data-mokly-fragment-frame="" data-workspace-frame="mobile" data-fragment-dark="\/static\/screens\/welcome\.mobile\.dark\.html" data-fragment-light="\/static\/screens\/welcome\.mobile\.html" sandbox="allow-same-origin" src="\/static\/screens\/welcome\.mobile\.html" title="Welcome — mobile"><\/iframe>/,
  );
  assert.match(
    screen,
    /<iframe class="mbk-frag" data-mokly-fragment-frame="" data-workspace-frame="desktop" data-fragment-dark="\/static\/screens\/welcome\.desktop\.dark\.html" data-fragment-light="\/static\/screens\/welcome\.desktop\.html" sandbox="allow-same-origin" src="\/static\/screens\/welcome\.desktop\.html" title="Welcome — desktop"><\/iframe>/,
  );
  assert.equal(screen.includes("data-color-scheme-fallback"), false);
  assert.equal(screen.includes("mbk-frame-scheme-note"), false);
  assertLightSrcMatchesAttribute(screen, 2);

  const fallback = routePage(dark, "screens/details.html");
  assert.match(
    fallback,
    /<div class="mbk-frame-wrap mbk-frame-mobile" data-color-scheme-fallback=""><p class="mbk-frame-label">Mobile<span class="mbk-frame-scheme-note"> — Light only<\/span><\/p>/,
  );
  assert.match(
    fallback,
    /<div class="mbk-frame-wrap mbk-frame-desktop" data-color-scheme-fallback=""><p class="mbk-frame-label">Desktop<span class="mbk-frame-scheme-note"> — Light only<\/span><\/p>/,
  );
  assert.match(
    fallback,
    /<iframe class="mbk-frag" data-mokly-fragment-frame="" data-workspace-frame="mobile" data-fragment-light="\/static\/screens\/details\.mobile\.html" sandbox="allow-same-origin" src="\/static\/screens\/details\.mobile\.html" title="Details — mobile"><\/iframe>/,
  );
  assert.equal(fallback.includes("data-fragment-dark"), false);
  assertLightSrcMatchesAttribute(fallback, 2);

  const flow = routePage(dark, "user-flows/tour.html");
  assert.match(
    flow,
    /<div class="mbk-flow-screen"><div class="browser-frame">[\s\S]*?<iframe class="mbk-frag" data-mokly-fragment-frame="" data-fragment-dark="\/static\/screens\/welcome\.desktop\.dark\.html" data-fragment-light="\/static\/screens\/welcome\.desktop\.html" sandbox="allow-same-origin"/,
  );
  assert.match(
    flow,
    /<div class="mbk-flow-screen" data-color-scheme-fallback=""><div class="browser-frame">[\s\S]*?<iframe class="mbk-frag" data-fragment-light="\/static\/screens\/details\.desktop\.html" sandbox="allow-same-origin"/,
  );
  assert.equal(flow.includes("mbk-frame-scheme-note"), false);
  assertLightSrcMatchesAttribute(flow, 2);

  const lightOnly = createCatalogue(manifest);
  const lightScreen = routePage(lightOnly, "screens/welcome.html");
  assert.match(
    lightScreen,
    /<div class="mbk-frame-wrap mbk-frame-mobile"><p class="mbk-frame-label">Mobile<\/p>/,
  );
  assert.match(
    lightScreen,
    /<iframe class="mbk-frag" data-mokly-fragment-frame="" data-workspace-frame="mobile" sandbox="allow-same-origin" src="\/static\/screens\/welcome\.mobile\.html" title="Welcome — mobile"><\/iframe>/,
  );
  assert.equal(lightScreen.includes("data-fragment-"), false);
  assert.equal(lightScreen.includes("data-color-scheme-fallback"), false);
  const lightFlow = routePage(lightOnly, "user-flows/tour.html");
  assert.match(
    lightFlow,
    /<div class="mbk-flow-screen"><div class="browser-frame">/,
  );
  assert.equal(lightFlow.includes("data-fragment-"), false);
});

test("details inspector lists dark fragments and the schemes row", () => {
  const dark = createCatalogue(darkManifest);
  const screen = routePage(dark, "screens/welcome.html");
  assert.ok(
    screen.includes(
      '<span class="mbk-meta-k">Generated</span><span class="mbk-meta-v">' +
        '<span class="mbk-chips">' +
        '<code class="mbk-code">screens/welcome.mobile.html</code>' +
        '<code class="mbk-code">screens/welcome.desktop.html</code>' +
        '<code class="mbk-code">screens/welcome.mobile.dark.html</code>' +
        '<code class="mbk-code">screens/welcome.desktop.dark.html</code>' +
        "</span></span></div>" +
        '<div class="mbk-meta-row"><span class="mbk-meta-k">Schemes</span>' +
        '<span class="mbk-meta-v">light, dark</span></div>' +
        '<div class="mbk-meta-row"><span class="mbk-meta-k">Tags</span>',
    ),
  );

  const fallback = routePage(dark, "screens/details.html");
  assert.ok(
    fallback.includes(
      '<span class="mbk-meta-k">Generated</span><span class="mbk-meta-v">' +
        '<span class="mbk-chips">' +
        '<code class="mbk-code">screens/details.mobile.html</code>' +
        '<code class="mbk-code">screens/details.desktop.html</code>' +
        "</span></span></div>" +
        '<div class="mbk-meta-row"><span class="mbk-meta-k">Schemes</span>' +
        '<span class="mbk-meta-v">light</span></div>',
    ),
  );

  const flow = routePage(dark, "user-flows/tour.html");
  assert.equal(flow.includes('mbk-meta-k">Schemes'), false);

  const lightOnly = createCatalogue(manifest);
  const lightScreen = routePage(lightOnly, "screens/welcome.html");
  assert.equal(lightScreen.includes('mbk-meta-k">Schemes'), false);
  assert.ok(
    lightScreen.includes(
      '<span class="mbk-meta-k">Generated</span><span class="mbk-meta-v">' +
        '<span class="mbk-chips">' +
        '<code class="mbk-code">screens/welcome.mobile.html</code>' +
        '<code class="mbk-code">screens/welcome.desktop.html</code>' +
        "</span></span></div>" +
        '<div class="mbk-meta-row"><span class="mbk-meta-k">Tags</span>',
    ),
  );
});

test("details inspector chips the tags an entry declares", () => {
  const dark = createCatalogue(darkManifest);
  const welcome = routePage(dark, "screens/welcome.html");
  assert.ok(
    welcome.includes(
      '<span class="mbk-meta-v">light, dark</span></div>' +
        tagsRow("forms", "onboarding") +
        '<div class="mbk-meta-row"><span class="mbk-meta-k">Related docs</span>',
    ),
  );

  const second = detailsSection(routePage(dark, "screens/details.html"));
  assert.ok(second.includes(tagsRow("billing")));

  const untagged = detailsSection(routePage(dark, "user-flows/tour.html"));
  assert.equal(untagged.includes('mbk-meta-k">Tags'), false);
  assert.equal(untagged.includes("data-mokly-tag"), false);
});

test("a use case chips its tags in the same details row", () => {
  const flow = routePage(
    createCatalogue(taggedFlowManifest),
    "user-flows/tour.html",
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

test("the search field carries a tag control over a closed picker", () => {
  const html = homePage(createCatalogue(manifest), context);
  assert.ok(
    html.includes(
      'aria-label="Search catalogue" data-mokly-search="" placeholder="Search catalogue…" type="search"/>' +
        TAG_TOGGLE +
        tagPicker("billing", "forms", "onboarding") +
        "</div>",
    ),
  );

  const untagged = homePage(createCatalogue(untaggedManifest), context);
  assert.match(untagged, /data-mokly-search/);
  assert.equal(untagged.includes("mbk-search-tag"), false);
  assert.equal(untagged.includes("mb-tag-picker"), false);
});

test("the brand names itself and the search bar drops that name", () => {
  const browse = homePage(createCatalogue(manifest), context);
  assert.ok(browse.includes('<header class="mbk-topbar" data-search="">'));
  const brand = browse.match(
    /<a aria-label="Mokly" class="mbk-brand" href="\/">(.*?)<\/a>/,
  )?.[1];
  assert.ok(brand);
  assert.match(
    brand,
    /<span aria-hidden="true" class="mbk-mark"><svg aria-hidden="true"/,
  );
  assert.match(brand, /height="17" stroke="currentColor"/);
  assert.ok(brand.endsWith('<span class="mbk-name">Mokly</span>'));
  assert.equal(brand.replace(/<[^>]*>/g, ""), "Mokly");

  assert.ok(
    flatCss(SHELL_CSS).includes(
      "@media (max-width: 56.25rem) { .mbk-menu { display: inline-flex; } " +
        ".mbk-topbar[data-search] .mbk-name { display: none; }",
    ),
  );
  assert.match(SHELL_CSS, /\.mbk-search \{[^}]*flex: 1;[^}]*min-width: 0;/);
  assert.match(SHELL_CSS, /\.mbk-mark \{[^}]*flex-shrink: 0;/);
});

test("the search field leads with a legible search icon, not a glyph", () => {
  const browse = homePage(createCatalogue(manifest), context);
  assert.ok(browse.includes("mbk-search"));
  assert.equal(browse.includes("\u2315"), false);
  assert.ok(
    browse.includes(
      '<div class="mbk-search">' +
        '<svg aria-hidden="true" fill="none" height="15" stroke="currentColor" ' +
        'stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ' +
        'viewBox="0 0 24 24" width="15">' +
        '<circle cx="11" cy="11" r="7"></circle>' +
        '<path d="M20 20l-3.9-3.9"></path></svg>',
    ),
  );
  assert.match(SHELL_CSS, /\.mbk-search > svg \{[^}]*flex-shrink: 0;/);
});

test("the browser bar draws copy and expand icons, not tiny glyphs", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byRoute.get("screens/welcome.html");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeRoute: "screens/welcome.html",
  });
  for (const glyph of ["⧉", "⤢", "⤡"]) {
    assert.equal(html.includes(glyph), false);
    assert.equal(SHELL_CSS.includes(glyph), false);
  }
  assert.match(
    html,
    /class="address-copy"><svg aria-hidden="true" fill="none" height="13"[^>]*width="13">/,
  );
  assert.match(
    html,
    /class="i-expand"><svg aria-hidden="true" fill="none" height="13"[^>]*width="13">/,
  );
  assert.match(
    html,
    /class="i-collapse"><svg aria-hidden="true" fill="none" height="13"[^>]*width="13">/,
  );
  assert.match(
    SHELL_CSS,
    /\.address-copy \{[^}]*flex-shrink: 0;[^}]*margin-left: auto;/,
  );
  assert.match(SHELL_CSS, /\.address-url \{[^}]*text-overflow: ellipsis;/);
  assert.match(SHELL_CSS, /\.browser-expand \.i-collapse \{\s*display: none;/);
  assert.match(
    SHELL_CSS,
    /\.browser-frame\.is-expanded \.browser-expand \.i-collapse \{\s*display: inline-flex;/,
  );
});

test("missing routes keep the catalogue shell", () => {
  const catalogue = createCatalogue(manifest);
  const missing = notFoundPage("view/unknown.html", catalogue, context);
  assert.match(missing, /Item not found/);
  assert.match(missing, /choose another item from the navigation/);
  assert.match(missing, /If this item was just added/);
  assert.match(missing, /aria-label="Catalogue"/);
});

test("filter renders in the nav only when changed routes are known", () => {
  const catalogue = createCatalogue(manifest);
  const withFilter = homePage(catalogue, {
    ...context,
    changedRoutes: ["screens/welcome.html"],
  });
  assert.match(withFilter, /data-mokly-filter/);
  assert.match(withFilter, /class="mbk-nav-filter-count">1</);
  const withNoChanges = homePage(catalogue, {
    ...context,
    changedRoutes: [],
  });
  assert.match(withNoChanges, /data-mokly-filter/);
  assert.match(withNoChanges, /class="mbk-nav-filter-count">0</);
  const withoutFilter = homePage(catalogue, context);
  assert.equal(withoutFilter.includes("data-mokly-filter"), false);
  assert.match(withoutFilter, /data-mokly-search/);
});

test("shell stylesheet stays aligned with the design contract", () => {
  assert.match(SHELL_CSS, /--mokly-accent: #4f7864/);
  assert.match(SHELL_CSS, /--mb-added: #1d7a3d/);
  assert.match(SHELL_CSS, /--mbk-dark-screen-bg: #121514/);
  assert.match(SHELL_CSS, /--mbk-dark-screen-ink: #eef1ef/);
  assert.match(SHELL_CSS, /color-scheme: light/);
  assert.match(SHELL_CSS, /width: 390px/);
  assert.match(SHELL_CSS, /max-width: 1180px/);
  assert.match(SHELL_CSS, /max-width: 56\.25rem/);
  assert.match(SHELL_CSS, /width: var\(--mbk-nav-width, 248px\)/);
  assert.match(
    SHELL_CSS,
    /\.mbk-nav-section-head \{[^}]*text-transform: uppercase;[^}]*cursor: pointer;/,
  );
  assert.match(
    SHELL_CSS,
    /\.mbk-nav-section\[open\][^{]*\.mbk-nav-section-chevron \{[^}]*transform: rotate\(90deg\);/,
  );
  assert.match(
    SHELL_CSS,
    /\.mbk-nav\[data-resize-ready\] \.mbk-nav-resize \{[\s\S]*display: block;/,
  );
  assert.match(
    SHELL_CSS,
    /@media \(max-width: 56\.25rem\) \{[\s\S]*\.mbk-nav-resize \{[\s\S]*display: none;/,
  );
  assert.match(
    SHELL_CSS,
    /\.phone-status \{[\s\S]*flex: 0 0 44px;[\s\S]*padding: 14px 28px 0;/,
  );
  assert.match(SHELL_CSS, /\.phone-screen \{[\s\S]*flex-direction: column;/);
  assert.match(
    SHELL_CSS,
    /\.phone-screen \.mbk-frag \{[\s\S]*border-radius: 0 0 36px 36px;/,
  );

  assert.match(SHELL_CSS, /prefers-reduced-motion/);
  assert.match(SHELL_CSS, /InterVariable\.woff2/);
  assert.match(SHELL_CSS, /\.mbk-idchip \{[\s\S]*cursor: pointer;/);
  assert.match(
    SHELL_CSS,
    /\.mbk-idchip:active \{[\s\S]*transform: translateY\(1px\);/,
  );
  assert.equal(SHELL_CSS.includes("bookfolio"), false);
});

test("tag chips select in the accent and the bar clears the scrim", () => {
  const css = flatCss(SHELL_CSS);
  assert.match(
    SHELL_CSS,
    /\.mbk-chip\.tag \{[^}]*font: inherit;[^}]*cursor: pointer;/,
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag svg { flex-shrink: 0; color: var(--chrome-muted); }",
    ),
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag:hover { background: var(--mokly-accent-soft); }",
    ),
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag.active { background: var(--mokly-accent); " +
        "border-color: var(--mokly-accent); " +
        "color: var(--mokly-accent-contrast); }",
    ),
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag.active svg { color: var(--mokly-accent-contrast); }",
    ),
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag:active { box-shadow: inset 0 1px 2px " +
        "rgba(20, 28, 22, 0.14); transform: translateY(1px); }",
    ),
  );
  assert.match(
    SHELL_CSS,
    /\.mbk-topbar \{[^}]*position: relative;[^}]*z-index: 11;/,
  );
  assert.match(SHELL_CSS, /\.mbk-skip-link \{[^}]*z-index: 20;/);
  assert.match(SHELL_CSS, /\.mbk-nav \{[^}]*z-index: 10;/);
});

test("the tag picker drops from the field and sheets under the bar", () => {
  const css = flatCss(SHELL_CSS);
  assert.match(SHELL_CSS, /\.mbk-search \{[^}]*position: relative;/);
  assert.match(
    SHELL_CSS,
    /\.mbk-search-tag \{[^}]*width: 20px;[^}]*height: 20px;[^}]*cursor: pointer;/,
  );
  assert.ok(
    css.includes(
      ".mbk-search-tag:hover { background: var(--chrome-border); " +
        "color: var(--chrome-ink-2); }",
    ),
  );
  assert.match(
    SHELL_CSS,
    /\.mbk-tag-picker \{[^}]*position: absolute;[^}]*top: calc\(100% \+ 7px\);[^}]*border-radius: 10px;[^}]*background: var\(--chrome-surface\);[^}]*box-shadow: var\(--chrome-shadow\);/,
  );
  assert.match(
    SHELL_CSS,
    /\.mbk-tag-picker-head \{[^}]*font-size: 11px;[^}]*text-transform: uppercase;/,
  );
  assert.ok(
    css.includes(
      ".mbk-tag-picker .mbk-chips { max-height: 210px; " +
        "overflow-y: auto; }",
    ),
  );
  assert.ok(css.includes(".mbk-search { position: static; }"));
  assert.ok(
    css.includes(
      ".mbk-tag-picker { top: calc(100% + 1px); right: 0; left: 0; " +
        "border-top: 0; border-radius: 0 0 12px 12px; }",
    ),
  );
});

test("dark scheme paints device screens and leaves the chrome light", () => {
  const css = flatCss(SHELL_CSS);
  const scope =
    'body[data-mokly-color-scheme="dark"] ' +
    ":is(.mbk-frame-wrap, .mbk-flow-screen):not([data-color-scheme-fallback]) ";

  assert.ok(
    css.includes(
      `${scope}.phone-screen { background: var(--mbk-dark-screen-bg); }`,
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.phone-screen::after { content: ""; position: absolute; ` +
        "inset: 0; border-radius: inherit; " +
        "box-shadow: inset 0 0 0 1px color-mix(in srgb, " +
        "var(--mbk-dark-screen-ink) 12%, var(--mbk-dark-screen-bg)); " +
        "pointer-events: none; }",
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.phone-status { color: var(--mbk-dark-screen-ink); }`,
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.phone-home { background: color-mix(in srgb, ` +
        "var(--mbk-dark-screen-ink) 40%, transparent); }",
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.browser-viewport { background: var(--mbk-dark-screen-bg); }`,
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.mbk-frag { background: var(--mbk-dark-screen-bg); }`,
    ),
  );

  const selectors = darkTokenSelectors(SHELL_CSS).map(flatCss);
  assert.equal(selectors.length, 6);
  for (const selector of selectors) {
    assert.ok(selector.startsWith(scope.trim()), selector);
  }

  assert.match(SHELL_CSS, /\.phone-screen \{[^}]*background: #ffffff;/);
  assert.match(SHELL_CSS, /\.phone-status \{[^}]*color: var\(--chrome-ink\);/);
  assert.match(
    SHELL_CSS,
    /\.phone-home \{[^}]*background: rgba\(20, 24, 20, 0\.4\);/,
  );
  assert.match(
    SHELL_CSS,
    /\.browser-viewport \{[^}]*background: var\(--chrome-surface\);/,
  );
});

test("frame labels note a light-only screen only under a dark selection", () => {
  const css = flatCss(SHELL_CSS);
  assert.ok(
    css.includes(".mbk-frame-scheme-note { display: none; font-weight: 500; }"),
  );
  assert.ok(
    css.includes(
      'body[data-mokly-color-scheme="dark"] ' +
        ".mbk-frame-wrap[data-color-scheme-fallback] " +
        ".mbk-frame-scheme-note { display: inline; }",
    ),
  );
});

test("one scheme switch instance shows per side of the breakpoint", () => {
  const css = flatCss(SHELL_CSS);
  assert.ok(
    css.includes(
      ".mbk-screen-head > [data-mokly-schemeswitch] " +
        "{ display: none; margin-left: 0; }",
    ),
  );
  assert.ok(
    css.includes(
      "@media (max-width: 56.25rem) { " +
        ".mbk-topbar > [data-mokly-schemeswitch] { display: none; } " +
        ".mbk-screen-head > [data-mokly-schemeswitch] " +
        "{ display: inline-flex; } }",
    ),
  );
});
