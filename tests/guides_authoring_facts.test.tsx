import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { __attributeDefinition } from "../dist/authoring/definitions.js";
import type { RegistryDefinition } from "../dist/authoring/types.js";
import { CONTROL_STYLES } from "../dist/build/link_control_patches.js";
import { adaptLinkControls } from "../dist/build/link_controls.js";
import { DEFAULT_PUBLIC_EXCLUDE } from "../dist/config/public_exclusions.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import {
  definePage,
  defineScreen,
  defineUseCase,
  MockLink,
} from "../dist/index.js";
import { prepareRegistry } from "../dist/registry/prepare.js";
import { classifyFrameActivation } from "../packages/viewer/dist/client/same_origin_navigation.js";
import { LOGICAL_FRAGMENT_PATTERN } from "../packages/viewer/dist/navigation/logical.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { GUIDES, guideSection } from "./helpers/guides.js";

const guide = (id: string) => GUIDES.find((page) => page.id === id)?.body ?? "";
const flat = (text: string) => text.replace(/\s+/gu, " ");
const links = flat(guide("authoring/links"));
const pages = flat(guide("authoring/pages"));

function adapt(element: React.ReactElement, wrap = (html: string) => html) {
  const html = renderToStaticMarkup(
    <MockLink asChild to="details">
      {element}
    </MockLink>,
  );
  return adaptLinkControls(
    `<!doctype html><html><head></head><body>${wrap(html)}</body></html>`,
    "screens/home.html",
  );
}

function adapts(element: React.ReactElement): boolean {
  try {
    adapt(element);
    return true;
  } catch {
    return false;
  }
}

function active(element: React.ReactElement, wrap?: (html: string) => string) {
  return /<a[^>]* href="mock:details"/u.test(adapt(element, wrap));
}

test("the documented fragment grammar is the build's grammar", () => {
  const sentence =
    /A fragment starts with an ASCII letter.*?\.(?=\s+[A-Z])/u.exec(links)?.[0];
  assert.ok(sentence, "the Links guide states the fragment grammar");
  const punctuation = new Set(
    [...sentence.matchAll(/`([^`])`/gu)].map(([, character]) => character),
  );
  assert.ok(punctuation.size > 0);
  for (const character of "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~ ")
    assert.equal(
      LOGICAL_FRAGMENT_PATTERN.test(`a${character}b`),
      punctuation.has(character),
      JSON.stringify(character),
    );
  for (const valid of ["a", "Z9", "summary-2"])
    assert.ok(LOGICAL_FRAGMENT_PATTERN.test(valid), valid);
  for (const invalid of ["9a", "_a", "-a", "é"])
    assert.equal(LOGICAL_FRAGMENT_PATTERN.test(invalid), false, invalid);
});

test("adapted controls accept exactly the documented roots and roles", () => {
  const roots = /exactly one root element: an HTML ([^.]*?) with no role/u.exec(
    links,
  )?.[1];
  assert.ok(roots, "the Links guide lists the supported roots");
  const tags = new Set(
    [...roots.matchAll(/`([a-z]+)`/gu)].map(([, tag]) => tag),
  );
  assert.deepEqual([...tags].sort(), ["a", "button", "div", "span"]);
  for (const tag of ["a", "button", "div", "span", "p", "li", "section"])
    assert.equal(
      adapts(React.createElement(tag, null, "Go")),
      tags.has(tag),
      tag,
    );
  const roles = new Set(
    [...links.matchAll(/`role="([a-z]+)"`/gu)].map(([, role]) => role),
  );
  assert.deepEqual([...roles].sort(), ["button", "link"]);
  for (const role of ["button", "link", "menuitem", "tab", "presentation"])
    assert.equal(adapts(<div role={role}>Go</div>), roles.has(role), role);
});

test("inactive controls follow the documented states", () => {
  const own: Array<[string, React.ButtonHTMLAttributes<HTMLButtonElement>]> = [
    ["disabled", { disabled: true }],
    ["inert", { inert: true }],
    ["aria-disabled", { "aria-disabled": true }],
    ["aria-busy", { "aria-busy": true }],
  ];
  for (const [name, state] of own) {
    assert.equal(active(<button {...state}>Go</button>), false, name);
    assert.ok(links.includes(`\`${name}`), name);
  }
  assert.equal(active(<button>Go</button>), true);
  const around = (open: string, close: string) => (html: string) =>
    `${open}${html}${close}`;
  for (const [open, close] of [
    ['<div inert="">', "</div>"],
    ['<div aria-disabled="true">', "</div>"],
    ['<div aria-busy="true">', "</div>"],
    ['<fieldset disabled="">', "</fieldset>"],
  ] as const)
    assert.equal(active(<span>Go</span>, around(open, close)), false, open);
  assert.equal(
    active(<span>Go</span>, around('<div disabled="">', "</div>")),
    true,
  );
  assert.match(links, /disabled `fieldset`/u);
});

test("adapted controls keep the documented display", () => {
  assert.match(
    CONTROL_STYLES,
    /a\[data-mokly-link-control="button"\]\)\{display:inline-block;width:fit-content\}/u,
  );
  assert.match(
    CONTROL_STYLES,
    /a\[data-mokly-link-control="div"\]\)\{display:block\}/u,
  );
  assert.match(links, /a `div` stays a block/u);
  assert.match(links, /a `button` stays `inline-block` and fits its content/u);
});

test("catalogue links open where the guide says", () => {
  const primary = {
    altKey: false,
    button: 0,
    ctrlKey: false,
    download: false,
    eventType: "click" as const,
    marker: "details",
    metaKey: false,
    shiftKey: false,
    target: null,
  };
  const kind = (patch: Partial<typeof primary> | Record<string, unknown>) =>
    classifyFrameActivation({ ...primary, ...patch })?.kind;
  assert.equal(kind({}), "navigate");
  for (const target of ["_self", "_top", "_parent"])
    assert.equal(kind({ target }), "navigate", target);
  for (const patch of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { eventType: "auxclick", button: 1 },
    { target: "_blank" },
    { target: "report" },
  ])
    assert.equal(kind(patch), "open", JSON.stringify(patch));
  assert.equal(kind({ altKey: true }), undefined);
  assert.equal(kind({ download: true }), undefined);
  for (const target of ["_top", "_parent"]) {
    assert.equal(kind({ target, ctrlKey: true }), "navigate", target);
    assert.equal(
      kind({ target, eventType: "auxclick", button: 1 }),
      "navigate",
      target,
    );
  }
  for (const phrase of [
    "including a link targeting `_self`, `_top` or `_parent`, opens that page in the catalogue",
    "Ctrl-, Cmd- or Shift-click and a middle click open it in a new tab or window",
    "A link targeting `_blank` or a named window also opens it in a new tab or window",
    "Links targeting `_top` or `_parent` stay in the catalogue",
    "Alt-click and links with `download` behave as ordinary links",
  ])
    assert.ok(links.includes(phrase), phrase);
});

test("screen scripts run only where the guide says", () => {
  const viewer = path.join(repositoryRoot, "packages/viewer/src");
  const sandboxes = readdirSync(viewer, { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/u.test(file) && !file.includes("_tests_"))
    .flatMap((file) =>
      [
        ...readFileSync(path.join(viewer, file), "utf8").matchAll(
          /sandbox(?:=|", )"([^"]*)"/gu,
        ),
      ].map(([, value]) => ({ file, value: value ?? "" })),
    );
  assert.ok(sandboxes.length > 5);
  assert.deepEqual(
    sandboxes
      .filter(({ value }) => value.split(" ").includes("allow-scripts"))
      .map(({ file }) => file),
    [path.join("client", "post_message_adapter.ts")],
  );
  assert.ok(
    sandboxes.some(
      ({ file, value }) =>
        file === path.join("client", "same_origin_mount.ts") &&
        value === "allow-same-origin",
    ),
  );
  const catalogue = flat(
    guideSection(guide("authoring/links"), "In the catalogue"),
  );
  for (const phrase of [
    "Screen scripts do not run in `mokly serve`, in an exported catalogue opened directly, or when `@mokly/viewer` embeds the catalogue from the same origin",
    "When `@mokly/viewer` embeds the catalogue from a separate origin, scripts in your screens run",
    "Comparisons and previous versions of removed screens never run scripts",
  ])
    assert.ok(catalogue.includes(phrase), phrase);
});

const config: ResolvedConfig = {
  generatedOutput: "committed",
  publicExclude: DEFAULT_PUBLIC_EXCLUDE,
  colorSchemes: ["light"],
  compatibility: { readManifestV2: false },
  configPath: path.join(repositoryRoot, "mokly.config.ts"),
  entriesDir: path.join(repositoryRoot, "tests"),
  entryGlobs: ["tests/**/*.mockup.{ts,tsx}"],
  mockupsDir: path.join(repositoryRoot, "mockups"),
  moduleResolution: { aliases: {}, loaders: {}, packageRoots: [] },
  repoRoot: repositoryRoot,
  review: { base: "main", outDir: ".review", sharedImpact: [] },
  sourceFiles: ["tests/guides_authoring_facts.test.tsx"],
  stylesheets: [],
  watch: { debounceMs: 100, rules: [] },
};

function prepare(definitions: readonly object[]): void {
  prepareRegistry(
    definitions.map((definition) =>
      __attributeDefinition(
        definition,
        "tests/guides_authoring_facts.test.tsx",
      ),
    ) as RegistryDefinition[],
    config,
  );
}

const handbook = {
  dependencies: [],
  description: "Product notes.",
  id: "handbook",
  relatedDocs: [],
  render: () => "<!doctype html><html><body>Notes</body></html>",
  route: "handbook.html",
  title: "Handbook",
};

test("pages reject the screen-only fields the guide names", () => {
  prepare([definePage(handbook)]);
  const sentence = /A page takes no screen-only fields[^.]*\./u.exec(
    pages,
  )?.[0];
  assert.ok(sentence, "the Pages guide names screen-only fields");
  const fields = [...sentence.matchAll(/`([A-Za-z]+)`/gu)].map(
    ([, field]) => field ?? "",
  );
  assert.ok(fields.length >= 4);
  for (const field of fields)
    assert.throws(
      () => prepare([definePage({ ...handbook, [field]: "x" } as never)]),
      { message: new RegExp(`invalid-page-field[^\\n]*${field}`, "u") },
      field,
    );
});

test("a use-case step cannot name a page", () => {
  assert.match(pages, /a use-case step cannot name a page/u);
  const screen = defineScreen({
    dependencies: [],
    description: "Home",
    desktop: "Desktop",
    id: "home",
    mobile: "Mobile",
    relatedDocs: [],
    route: "screens/home.html",
    title: "Home",
    useCaseIds: ["tour"],
  });
  const tour = (screenId: string) =>
    defineUseCase({
      dependencies: [],
      description: "Tour",
      id: "tour",
      relatedDocs: [],
      route: "user-flows/tour.html",
      steps: [{ screenId }],
      title: "Tour",
    });
  prepare([screen, definePage(handbook), tour("home")].flat());
  assert.throws(
    () => prepare([screen, definePage(handbook), tour("handbook")].flat()),
    { message: /missing-step-screen/u },
  );
});
