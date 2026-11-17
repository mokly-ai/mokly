import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { sample } from "../fixtures/product";
import { denseViewerChrome } from "../fixtures/product-states";

import { ownerOf, regionEnds, regions, repository } from "./app-owners";
import type { ScreenId } from "./app-owners";
import { outputRoot } from "./catalogue-paths";
import { controlLabels } from "./control-labels";

/**
 * Exactly the part of one drawn page its screen answers for. A drawing of the
 * published viewer has no bar of its own: the cloud fills the package's top bar
 * slots, so a bar screen drawn over it answers for the whole page. Every
 * document loads Mokly's inspector from `/mokly-viewer/`, so that drawing is
 * known by the depiction's own wrapper.
 */
function regionHtml(file: string, screen: ScreenId): string {
  const owner = ownerOf(screen);
  const whole = readFileSync(resolve(outputRoot, file), "utf8");
  if (owner.region === "bar" && whole.includes("fo-published-viewer"))
    return whole;
  const start = whole.indexOf(regions[owner.region]);
  if (start < 0) return "";
  const until = regionEnds[owner.region];
  if (until === undefined) return whole.slice(start);
  const stop = whole.indexOf(until, start);
  return stop < 0 ? whole.slice(start) : whole.slice(start, stop);
}

/**
 * What the catalogue says on that page's own controls and state bodies: every
 * action's label, every option of a segmented control the reader operates,
 * every pending operation and the title a state announces itself with. Both
 * viewports render one component, so the desktop page carries the whole set.
 */
export function drawnLabels(file: string, screen: ScreenId): string[] {
  const html = regionHtml(file, screen);
  const found = controlLabels(html);
  for (const pending of drawnPendingLabels(file, screen))
    found.push(pending.label);
  for (const title of html.matchAll(/class="fo-state-title"[^>]*>([^<]*)</g))
    found.push(title[1]);
  return [...new Set(found)];
}

/** Whether one pending label is visible or only exposed to assistive technology. */
export type PendingLabelMode = "visible" | "screen-reader-only";

/** One pending label rendered in a catalogued screen region. */
export interface PendingLabelRendering {
  label: string;
  mode: PendingLabelMode;
}

/** Pending labels and their presentation in one catalogued screen region. */
export function drawnPendingLabels(
  file: string,
  screen: ScreenId,
): PendingLabelRendering[] {
  const found: PendingLabelRendering[] = [];
  for (const pending of regionHtml(file, screen).matchAll(
    /class="([^"]*\bfo-pending-label\b[^"]*)"[^>]*>([\s\S]*?)<\/span>/g,
  )) {
    const label = pending[2]
      .replaceAll(/<!--[\s\S]*?-->/g, "")
      .replaceAll(/<[^>]*>/g, "")
      .replace(/…$/, "")
      .trim();
    if (label)
      found.push({
        label,
        mode: pending[1].split(/\s+/).includes("fo-sr-only")
          ? "screen-reader-only"
          : "visible",
      });
  }
  return found;
}

/**
 * One application source, with its comments removed. A sentence left behind in
 * a comment is not a sentence the product says, and crediting one is how a
 * deleted label goes unnoticed.
 */
export function source(path: string): string {
  return readFileSync(resolve(repository, "apps/app/src", path), "utf8")
    .replaceAll(/\/\*[\s\S]*?\*\//g, " ")
    .replaceAll(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
}

/** Fixture values a label may carry, so the literal around them is compared. */
const interpolated = [
  "Mokly Cloud",
  sample.workspace,
  "Mokly",
  "Sam",
  "Cal",
  "Alex",
  "jordan.mccallister@example.com",
  "calummoore/sydney-v1",
  "sydney-v1",
  "GitHub Actions",
  denseViewerChrome.workspace,
  denseViewerChrome.email,
];

/**
 * Whether the running screen writes that label, allowing for fixture names.
 *
 * A label built around a fixture value is compared by the literal around it. A
 * label that is *only* a fixture value — the branch a trigger names, the person
 * the account slot is called by — is the reader's own data rather than a
 * sentence the product wrote, so there is no literal to find and none to
 * demand.
 */
export function written(label: string, source: string): boolean {
  if (dataLabel(label)) return true;
  const quoted = (text: string) => source.includes('"' + text + '"');
  if (quoted(label)) return true;
  if (writtenByTemplate(label, source)) return true;
  const stem = stemOf(label);
  return stem !== label && stem.length > 0 && quoted(stem);
}

/** Whether a template literal supplies the label around runtime-owned data. */
function writtenByTemplate(label: string, source: string): boolean {
  for (const template of source.matchAll(/`([^`]*)`/g)) {
    const parts = template[1].split(/\$\{[^}]+\}/);
    if (parts.length < 2) continue;
    let end = 0;
    let matches = true;
    for (const [index, part] of parts.entries()) {
      const start = label.indexOf(part, end);
      if (
        start < 0 ||
        (index === 0 && start !== 0) ||
        (index === parts.length - 1 && start + part.length !== label.length)
      ) {
        matches = false;
        break;
      }
      end = start + part.length;
    }
    if (matches) return true;
  }
  return false;
}

/** Labels one owner source no longer writes, exposed for mutation coverage. */
export function unwrittenLabels(
  labels: readonly string[],
  ownerSource: string,
): string[] {
  return labels.filter((label) => !written(label, ownerSource));
}

/** One label with every fixture value taken out of it. */
function stemOf(label: string): string {
  return interpolated.reduce(
    (text, value) => text.replaceAll(value, ""),
    label,
  );
}

/**
 * Whether a label is the reader's own data rather than a sentence the product
 * wrote: the branch a trigger names, the person the account slot is called by.
 * There is no literal to find, so no file can be credited for writing it — and
 * a declaration proves nothing by pointing at one.
 */
export function dataLabel(label: string): boolean {
  return label.length > 0 && stemOf(label).length === 0;
}

/** Only the titles a page's states announce themselves with. */
export function drawnStateTitles(file: string, screen: ScreenId): string[] {
  return [
    ...regionHtml(file, screen).matchAll(
      /class="fo-state-title"[^>]*>([^<]*)</g,
    ),
  ].map((match) => match[1]);
}

/**
 * Read one application source file with its comments removed, the way every
 * other comparison here reads one: a sentence left behind in a comment is not
 * a sentence the product says.
 */
export function appSource(path: string): string {
  return source(path);
}
