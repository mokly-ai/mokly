/**
 * The stage cards' drawn pages as the policy tests read them: the viewer builds
 * contract as one line of words, every view of one drawing, the registered
 * buttons a region draws and the stage's own markup.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse, serializeOuter } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

import { catalogueRoot, screenFile } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import type { Element } from "./design-site-test-helpers";

/** The viewer builds contract as one line of words, for quoted copy. */
export const contract = readFileSync(
  resolve(catalogueRoot, "../protocol/viewer-builds.md"),
  "utf8",
).replace(/\s+/g, " ");

/** Every view of one drawing, parsed, with a name for failures. */
export function views(path: string): {
  where: string;
  view: string;
  page: DefaultTreeAdapterMap["document"];
}[] {
  return (["mobile", "desktop"] as const).flatMap((viewport) =>
    (["light", "dark"] as const).map((scheme) => ({
      where: path + " " + viewport + " " + scheme,
      view: viewport + " " + scheme,
      page: parse(readFileSync(screenFile(path, viewport, scheme), "utf8")),
    })),
  );
}

/**
 * The stage of one parsed page, with each link's relative address replaced:
 * a drawing one folder deeper reaches the same drawing by a longer path, and
 * `data-mokly-link` still names where every link leads.
 */
export function stageMarkup(page: DefaultTreeAdapterMap["document"]): string {
  const [canvas] = byClass(page, "fo-stage-canvas");
  assert.ok(canvas);
  return serializeOuter(canvas).replaceAll(/ href="[^"]*"/g, " href");
}

/** The registered buttons one region draws, with where each one leads. */
export function buttons(region: Element): (string | undefined)[][] {
  return elements(region, (node) =>
    (attribute(node, "data-testid") ?? "").startsWith("firna-button-"),
  ).map((node) => [
    label(node),
    attribute(node, "data-testid"),
    attribute(node, "data-mokly-link"),
  ]);
}
