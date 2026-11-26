/**
 * The focus glow of the site and of its mockups, from their sheets: every
 * focus rule draws one of the glows of docs/protocol/cloud/site-design.md,
 * ranks above the shadow that its control draws at rest and under the
 * pointer, and keeps the resting shadow under the glow; only the glow
 * removes the outline, and forced colours keep a system outline. The
 * mockup sheets are the ones that the site mockups load: the font sheets of
 * the site rule of `mokly.config.json`, then the CSS that each site screen
 * imports, read from the sources as the mockup tests read them. The browser
 * walk checks the drawn glow of every control on a page of each template, and
 * `contrast.test.ts` checks that the glow keeps 3:1.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  siteScreens,
  siteStylesheets,
  type SiteScreenPath,
} from "../../../docs/mockups/src/_tests_/site-stylesheets.js";

import { repositoryRoot } from "./helpers/fixture.js";

/** The two glows: the signal ink on the page, the signal in the code panel. */
const GLOW = "color-mix(in srgb, var(--mk-color-signal-deep) 75%, transparent)";
const CODE_GLOW = "color-mix(in srgb, var(--mk-color-signal) 75%, transparent)";

/** The halos a focus rule may draw: outside or inside, 4px with no blur. */
const HALOS = [`0 0 0 4px ${GLOW}`, `inset 0 0 0 4px ${GLOW}`];
const CODE_HALO = `inset 0 0 0 4px ${CODE_GLOW}`;

interface Rule {
  readonly declarations: readonly string[];
  /** Whether the rule sits in a forced-colors media query. */
  readonly forced: boolean;
  readonly order: number;
  readonly selector: string;
  readonly sheet: string;
}

/**
 * The sheets of one site mockup, or of every site mockup, as absolute paths,
 * in cascade order.
 */
function mockupSheets(screen?: SiteScreenPath): string[] {
  return siteStylesheets(screen).map((sheet) =>
    path.resolve(repositoryRoot, sheet),
  );
}

/** Every site sheet as an absolute path, in name order. */
function siteSheets(): string[] {
  const directory = path.resolve(import.meta.dirname, "..", "src", "styles");
  return readdirSync(directory)
    .filter((name) => name.endsWith(".css"))
    .sort()
    .map((name) => path.resolve(directory, name));
}

/** Every style rule of the named sheets, in their order, with its context. */
function rules(files: readonly string[]): Rule[] {
  const found: Rule[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const forced = [...source.matchAll(/@media \(forced-colors: active\)/g)];
    for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector = "", body = ""] = match;
      if (selector.trim().startsWith("@")) continue;
      found.push({
        declarations: body
          .split(";")
          .map((line) => line.trim().replace(/\s+/g, " "))
          .map((line) => line.replace(/\( | \)/g, (space) => space.trim()))
          .filter((line) => line.length > 0),
        forced: forced.some(
          ({ index }) =>
            match.index > index && match.index < source.indexOf("\n}", index),
        ),
        order: found.length,
        selector: selector
          .trim()
          .replace(/\s+/g, " ")
          .replace(/\( | \)/g, (space) => space.trim()),
        sheet: path.basename(file),
      });
    }
  }
  return found;
}

/** The selectors of a rule's list. */
function parts(rule: Rule): string[] {
  return rule.selector.split(/,(?![^(]*\))/).map((part) => part.trim());
}

/** A rule's `box-shadow` value, if it declares one. */
function shadow(rule: Rule): string | undefined {
  return rule.declarations
    .find((line) => line.startsWith("box-shadow: "))
    ?.slice("box-shadow: ".length);
}

const sides = {
  mockup: { global: ".site-root :focus-visible", rules: rules(mockupSheets()) },
  site: { global: ":focus-visible", rules: rules(siteSheets()) },
};

for (const [side, { global, rules: all }] of Object.entries(sides)) {
  const focus = all.filter((rule) => rule.selector.includes(":focus-visible"));
  const glows = focus.filter((rule) => !rule.forced);
  const forced = focus.filter((rule) => rule.forced);

  test(`${side}: every focus rule draws the glow over its control's own shadow`, () => {
    const base = glows.find((rule) => rule.selector === global);
    assert.deepEqual(base?.declarations, [
      `box-shadow: ${HALOS[0]}`,
      "outline: none",
    ]);
    for (const rule of glows) {
      const where = `${rule.sheet}: ${rule.selector}`;
      const value = shadow(rule) ?? "";
      const code = rule.selector.includes(".site-code") ? [CODE_HALO] : [];
      const halo = [...HALOS, ...code].find(
        (item) => value === item || value.startsWith(`${item}, `),
      );
      assert.ok(halo, `${where} draws ${value}`);
      const kept: string = value.slice(halo.length + 2) || "none";
      // The control's own shadow at rest ranks below the focus rule, which
      // keeps it under the glow. A hover or press rule that draws a shadow
      // comes earlier in the same sheet.
      for (const part of parts(rule)) {
        const control = part.replace(":focus-visible", "");
        for (const other of all.filter((item) => !item.forced)) {
          const own = shadow(other);
          if (own === undefined) continue;
          for (const state of parts(other)) {
            if (state === control) {
              assert.equal(kept, own, `${where} keeps ${own}`);
            } else if (state.replace(/:hover|:active/g, "") === control) {
              const earlier =
                other.sheet === rule.sheet && other.order < rule.order;
              assert.ok(earlier, `${other.sheet}: ${state} hides ${where}`);
            }
          }
        }
      }
    }
    for (const rule of all)
      for (const line of rule.declarations)
        if (/^outline(?:-style|-width)?: (?:none|0|hidden)\b/.test(line))
          assert.equal(rule, base, `${rule.sheet}: ${rule.selector} ${line}`);
  });

  test(`${side}: forced colours keep a system outline`, () => {
    assert.deepEqual(
      forced.find((rule) => rule.selector === global)?.declarations,
      ["box-shadow: none", "outline: 2px solid Highlight"],
    );
    if (side === "mockup") return;
    // The segment of a hidden radio draws the radio's focus, so in forced
    // colours the segment keeps an outline of its own.
    const hosts = glows.flatMap(parts).filter((part) => part.includes(":has("));
    assert.ok(hosts.length > 0, "no segment draws a radio's focus");
    for (const host of hosts) {
      const rule = forced.find((item) => parts(item).includes(host));
      assert.match(
        rule?.declarations.join("; ") ?? "",
        /outline: 2px solid (?:CanvasText|Highlight)/,
        host,
      );
    }
  });
}

// Each site mockup loads only the shared sheets and its own area's sheets,
// so each one must carry the base glow and the forced-colours outline.
for (const screen of siteScreens) {
  test(`mockup ${screen}: its own sheets hold the base glow and the forced outline`, () => {
    const own = rules(mockupSheets(screen)).filter(
      (rule) => rule.selector === sides.mockup.global,
    );
    assert.deepEqual(own.find((rule) => !rule.forced)?.declarations, [
      `box-shadow: ${HALOS[0]}`,
      "outline: none",
    ]);
    assert.deepEqual(own.find((rule) => rule.forced)?.declarations, [
      "box-shadow: none",
      "outline: 2px solid Highlight",
    ]);
  });
}
