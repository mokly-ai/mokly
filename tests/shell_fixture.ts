import assert from "node:assert/strict";

import {
  homePage as renderHomePage,
  notFoundPage as renderNotFoundPage,
  viewPage as renderViewPage,
} from "../dist/server/pages.js";
import { parseViewHref } from "../packages/viewer/dist/data.js";
import type { ManifestV8 } from "../packages/viewer/dist/registry/types.js";
import type { Catalogue } from "../packages/viewer/dist/shell/catalogue.js";
import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import { renderViewer } from "../packages/viewer/dist/viewer/server.js";

import {
  attribute,
  documentElements,
  type HtmlElement,
} from "./helpers/html.js";
import { publicShellContext } from "./helpers/public_shell.js";

export const manifest: ManifestV8 = {
  entries: [
    {
      kind: "page",
      id: "old",
      title: "Old",
      description: "Original complete document",
      sourcePath: "entries/fixture.mockup.tsx",
      relatedDocs: [],
      navPath: ["Example"],
    },
    {
      kind: "page",
      id: "overview",
      title: "Overview",
      description: "Catalogue overview",
      sourcePath: "entries/fixture.mockup.tsx",
      relatedDocs: [],
      navPath: ["Example"],
    },
    {
      address: "example.test/welcome",
      colorSchemes: ["light"],

      description: "Landing screen",
      id: "welcome",
      kind: "screen",
      navPath: ["Example", "Screens"],
      rationale: "Proves the shell",
      relatedDocs: ["notes.md"],
      sourcePath: "entries/fixture.mockup.tsx",
      tags: ["forms", "onboarding"],
      title: "Welcome",
      useCaseIds: ["tour"],
    },
    {
      colorSchemes: ["light"],
      description: "Second screen",
      id: "details",
      kind: "screen",
      navPath: ["Example", "Screens"],
      relatedDocs: [],
      sourcePath: "entries/fixture.mockup.tsx",
      tags: ["billing"],
      title: "Details",
      useCaseIds: ["tour"],
    },
    {
      description: "Ordered journey",
      id: "tour",
      kind: "use-case",
      navPath: ["Example"],
      relatedDocs: [],
      sourcePath: "entries/fixture.mockup.tsx",
      steps: [{ screenId: "welcome" }, { screenId: "details" }],
      title: "Tour",
    },
  ],
  generatedBy: "mokly",
  sourceFiles: ["entries/fixture.mockup.tsx"],
  schemaVersion: 8,
};

export const darkManifest: ManifestV8 = {
  ...manifest,
  entries: manifest.entries.map((entry) =>
    entry.kind === "screen" && entry.id === "welcome"
      ? {
          ...entry,
          colorSchemes: ["light", "dark"],
        }
      : entry,
  ),
};

export const taggedFlowManifest: ManifestV8 = {
  ...manifest,
  entries: manifest.entries.map((entry) =>
    entry.kind === "use-case"
      ? { ...entry, tags: ["onboarding", "walkthrough"] }
      : entry,
  ),
};

export const untaggedManifest: ManifestV8 = {
  ...manifest,
  entries: manifest.entries.map((entry) => {
    const { tags: _tags, ...untagged } = entry;
    return untagged;
  }),
};

export const context = {
  base: "origin/main",
  updateVersion: 1,
};

export function homePage(catalogue: Catalogue, value: ShellContext): string {
  return renderHomePage(catalogue, publicShellContext(catalogue, value));
}

export function notFoundPage(
  detail: string,
  catalogue: Catalogue,
  value: ShellContext,
): string {
  return renderNotFoundPage(
    detail,
    catalogue,
    publicShellContext(catalogue, value),
  );
}

export function viewPage(
  entry: Parameters<typeof renderViewPage>[0],
  catalogue: Catalogue,
  value: ShellContext,
): string {
  return renderViewPage(entry, catalogue, publicShellContext(catalogue, value));
}

/** The shell's tag glyph at one rendered size. */
export function tagIcon(size: number): string {
  return (
    `<svg aria-hidden="true" fill="none" height="${size}" stroke="currentColor" ` +
    'stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ' +
    `viewBox="0 0 24 24" width="${size}">` +
    '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7.4-7.4A2 2 0 0 1 2.6 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.6 7.6a2 2 0 0 1 0 2.8z"></path>' +
    '<path d="M7.6 7.6h.01"></path></svg>'
  );
}

/** One tag chip exactly as the approved mockup draws it, on either surface. */
export function tagChip(tag: string): string {
  return (
    `<button aria-pressed="false" class="mbk-chip tag" ` +
    `data-mokly-tag="${tag}" type="button">${tagIcon(11)}${tag}</button>`
  );
}

/** The metadata row wrapping one entry's tag chips. */
export function tagsRow(...tags: readonly string[]): string {
  return (
    '<div class="mbk-meta-row"><span class="mbk-meta-k">Tags</span>' +
    '<span class="mbk-meta-v"><span class="mbk-chips">' +
    tags.map(tagChip).join("") +
    "</span></span></div>"
  );
}

export const SCHEME_SWITCH =
  '<span aria-label="Preview color scheme" class="mbk-seg" data-mokly-schemeswitch="" role="group">' +
  '<button aria-pressed="true" data-color-scheme-option="light" type="button">Light</button>' +
  '<button aria-pressed="false" data-color-scheme-option="dark" type="button">Dark</button>' +
  "</span>";

export function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Collapse stylesheet whitespace so contract assertions pin selectors and
 * declarations rather than the source module's line wrapping.
 */
export function flatCss(css: string): string {
  return css.replace(/\s+/g, " ").replace(/\(\s/g, "(").replace(/\s\)/g, ")");
}

/**
 * The selector of every declaration block that reads a dark screen token, used
 * to prove the dark palette cannot reach the light render.
 */
export function darkTokenSelectors(css: string): string[] {
  return css
    .split("}")
    .filter((block) => block.includes("var(--mbk-dark-screen-"))
    .map((block) => block.slice(0, block.lastIndexOf("{")).trim());
}

/** The details inspector alone, so top-bar chips cannot satisfy a check. */
export function detailsSection(html: string): string {
  const legacy = html.indexOf('<details class="mbk-details"');
  const start = legacy >= 0 ? legacy : html.indexOf('class="mbk-inspector"');
  assert.ok(start > -1);
  return html.slice(start);
}

export function hasClass(element: HtmlElement, name: string): boolean {
  return (attribute(element, "class") ?? "").split(/\s+/).includes(name);
}

export function requiredElement(
  html: string,
  predicate: (element: HtmlElement) => boolean,
): HtmlElement {
  const matches = documentElements(html, predicate);
  assert.equal(matches.length, 1);
  return matches[0]!;
}

export function workspaceFrame(html: string, viewport: string): HtmlElement {
  return requiredElement(
    html,
    (element) =>
      element.tagName === "iframe" &&
      attribute(element, "data-workspace-frame") === viewport,
  );
}

export function assertAttributes(
  element: HtmlElement,
  expected: Readonly<Record<string, string | undefined>>,
): void {
  for (const [name, value] of Object.entries(expected))
    assert.equal(attribute(element, name), value, name);
}

export function routePage(
  catalogue: Catalogue,
  route: string,
  extra: Partial<ShellContext> = {},
): string {
  const identity = parseViewHref(`/view/${route}`);
  assert.ok(identity);
  const entry = catalogue.byId.get(identity.id);
  assert.ok(entry && entry.kind === identity.kind);
  return viewPage(entry, catalogue, {
    ...context,
    activeId: entry.id,
    ...extra,
  });
}

export function embeddedPage(
  catalogue: Catalogue,
  screenId: string | null,
): string {
  const { readModel } = publicShellContext(catalogue, context);
  return renderViewer({
    viewerId: "shell-test",
    catalogue: readModel,
    baseUrl: "https://catalogue.example",
    defaultSelection: { screenId },
  });
}

/**
 * Every scheme-aware frame serves its light fragment until the client swaps it,
 * so the rendered src must equal the light attribute the client assigns back.
 */
export function assertLightSrcMatchesAttribute(
  html: string,
  frames: number,
): void {
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
