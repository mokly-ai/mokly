import assert from "node:assert/strict";

import { parseViewHref } from "../packages/viewer/dist/data.js";
import type { Catalogue } from "../packages/viewer/dist/shell/catalogue.js";
import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import { renderViewer } from "../packages/viewer/dist/viewer/server.js";

import {
  attribute,
  documentElements,
  type HtmlElement,
} from "./helpers/html.js";
import { publicShellContext } from "./helpers/public_shell.js";
import { context, viewPage } from "./shell_fixture.js";

export /**
 * The selector of every declaration block that reads a dark screen token, used
 * to prove the dark palette cannot reach the light render.
 */
function darkTokenSelectors(css: string): string[] {
  return css
    .split("}")
    .filter((block) => block.includes("var(--mbk-dark-screen-"))
    .map((block) => block.slice(0, block.lastIndexOf("{")).trim());
}

export /** The details inspector alone, so top-bar chips cannot satisfy a check. */
function detailsSection(html: string): string {
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

export /**
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
