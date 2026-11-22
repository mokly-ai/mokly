/**
 * The focus glow of the site mockups and the site, from their sheets: every
 * focus rule draws one of the glows of docs/protocol/cloud/site-design.md,
 * ranks above the shadow that its control draws at rest and under the
 * pointer, and keeps the resting shadow under the glow; only the glow
 * removes the outline, and forced colours keep a system outline. The site's
 * browser walk checks the drawn glow of every control on every route.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { test } from "node:test";

import { tokens } from "@mokly-cloud/tokens/tokens";

import { repositoryRoot, siteStylesheets } from "./design-site-test-helpers";

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
        sheet: basename(file),
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
  mockup: {
    global: ".site-root :focus-visible",
    rules: rules(
      siteStylesheets().map((path) => resolve(repositoryRoot, path)),
    ),
  },
  site: {
    global: ":focus-visible",
    rules: rules(
      readdirSync(resolve(repositoryRoot, "apps/site/src/styles"))
        .filter((name) => name.endsWith(".css"))
        .sort()
        .map((name) => resolve(repositoryRoot, "apps/site/src/styles", name)),
    ),
  },
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

/** A colour role of the token palette. */
type Role = {
  [
    Key in keyof typeof tokens.color.light
  ]: (typeof tokens.color.light)[Key] extends string ? Key : never;
}[keyof typeof tokens.color.light];

/** The relative luminance of sRGB channels. */
function luminance(colour: readonly number[]): number {
  const [red = 0, green = 0, blue = 0] = colour.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The channels of a `#rrggbb` token value. */
function channels(value: string): number[] {
  return [1, 3, 5].map((at) => Number.parseInt(value.slice(at, at + 2), 16));
}

test("the glow keeps 3:1 against every surface it draws on, in both schemes", () => {
  // Each glow with the surface it sits on in light and in dark: the page
  // glow on the canvas and the page's surfaces, and the code glow on the
  // code panel, which text fills in light and the muted surface in dark.
  const backdrops: ReadonlyArray<readonly [Role, Role, Role]> = [
    ["signalDeep", "background", "background"],
    ["signalDeep", "surface", "surface"],
    ["signalDeep", "surfaceMuted", "surfaceMuted"],
    ["signalDeep", "surfaceRaised", "surfaceRaised"],
    ["signalDeep", "signalSoft", "signalSoft"],
    ["signal", "text", "surfaceMuted"],
  ];
  for (const [glow, light, dark] of backdrops) {
    for (const [scheme, behind] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      // The glow at 75% over an opaque fill, as the browser composites it.
      const fill = channels(tokens.color[scheme][behind]);
      const halo = channels(tokens.color[scheme][glow]).map(
        (channel, at) => channel * 0.75 + (fill[at] ?? 0) * 0.25,
      );
      const [high = 0, low = 0] = [luminance(halo), luminance(fill)].sort(
        (a, b) => b - a,
      );
      const ratio = (high + 0.05) / (low + 0.05);
      assert.ok(ratio >= 3, `${scheme}: ${glow} on ${behind}, ${ratio}:1`);
    }
  }
});
