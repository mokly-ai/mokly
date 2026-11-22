import assert from "node:assert/strict";
import test from "node:test";

import { markedBoundaryRules } from "./helpers/design_boundary_rules.js";
import {
  auditPalettes,
  boundaryContrast,
  designPalette,
  PREVIEW_SHEET,
} from "./helpers/design_palette.js";
import {
  boundaryOf,
  designStyleRules,
  fillOf,
  type ColorReference,
  type StyleRule,
} from "./helpers/design_styles.js";

/** Selectors naming a control primitive, whose boundary is a control edge. */
const CONTROL_SELECTOR =
  /\bbutton\b|\binput\b|\bselect\b|\bsummary\b|\btextarea\b|\.mbk-icon-(?:button|select)|\.mbk-seg|\.mbk-appearance|\.mbk-chip:is\(\.flow, \.screen\)/u;

/**
 * `@mokly/ui` stylesheets that style a control through a base class whose
 * selector names no control primitive, so each boundary there is a control
 * edge too: the chip rule draws the resting edge of every tag chip.
 */
const CONTROL_SHEETS = new Set(["packages/ui/src/tag-chip/tag-chip.css"]);

/** Tokens the palette contract reserves for decoration between surfaces. */
const HAIRLINE_TOKENS = new Set([
  "--chrome-border",
  "--chrome-border-strong",
  "--mbk-guide",
]);

/**
 * Boundaries the palette contract exempts from 3:1, each with the reason that
 * exempts it, so a new entry has to state why rather than join a list.
 */
const DECORATIVE_BOUNDARIES = new Map([
  [".mbk-control-alert", "a label naming its own state in 5.97:1 ink"],
  [
    ":where(.browser-bar:not([data-browser-static])) .browser-expand:hover:where(.mbk-reset)",
    "the user kept the shipped border on 2026-10-31",
  ],
]);

/**
 * Surfaces that draw a hairline inside a state selector because the state
 * belongs to a descendant, not to a control. Each entry must be reached by the
 * audit, so a future control cannot quietly inherit the exemption.
 */
const EXEMPT_SURFACES = new Map<string, string>();

/**
 * Control surfaces that keep a decorative hairline, each named as the audit
 * names a rule, by its sheet and selector, with the reason that exempts it.
 * Each entry must be reached by the control-edge audit, so a future control
 * cannot quietly inherit the exemption. A kept hairline that a state draws,
 * such as a pressed icon control's, is exempt from the marked-boundary audit
 * too: the state shows through its fill and its accent glyph.
 */
const EXEMPT_CONTROL_SURFACES = new Map([
  [
    'packages/ui/src/icon-control/icon-control.css .mbk-icon-button[aria-selected="true"], .mbk-icon-button[aria-pressed="true"], .mbk-icon-button:has(> input:checked), details[open] > summary.mbk-icon-button',
    "the user kept the shipped border on 2026-10-30",
  ],
  [
    "packages/ui/src/tag-chip/tag-chip.css .mbk-chip",
    "the user kept the shipped border on 2026-10-30",
  ],
  [
    'packages/ui/src/instance-tree/instance-tree.css .mbk-instance-select[aria-pressed="true"], .mbk-instance-tree a.mbk-instance-select[aria-current="true"]',
    "the user kept the shipped border on 2026-10-31",
  ],
]);

/**
 * Every rule the audit collects, so a failure names the rule that appeared or
 * vanished instead of only reporting that the total moved. A component that
 * `@mokly/ui` provides is audited in the package stylesheet that its library
 * sheet imports.
 */
const AUDITED_BOUNDARIES = [
  "design-components.css .ce-badge",
  "design-components.css .ce-design a:focus-visible, .ce-design button:focus-visible, .ce-design summary:focus-visible, .ce-design input:focus-visible, .ce-design select:focus-visible",
  "design-canvas-inspect.css .cv-variant[aria-current] > .cv-variant-mark",
  "design-library/inspector/frames-filter.css .cv-ff:has(> input:checked)",
  "design-library/inspector/frames-filter.css .cv-ff:has(> input:focus-visible)",
  "design-library/inspector/frames-filter.css .cv-switch > input:checked + .cv-switch-track",
  "design-library/inspector/frames-filter.css .cv-switch > input:focus-visible + .cv-switch-track",
  "design-library/panels/compare-modes.css .cv-mode-frame[aria-current]",
  "design-library/panels/compare-modes.css .cv-mode-switch > input:checked + .cv-mode-switch-track",
  "design-library/panels/compare-modes.css .cv-mode-switch > input:focus-visible + .cv-mode-switch-track",
  "design-library/panels/compare-modes.css .cv-mode[aria-current]",
  // The package controls draw keyboard focus as a glow, a shadow rather than a
  // boundary; packages/ui/tests/palette.test.ts holds the glow at 3:1.
  "packages/ui/src/appearance-selector/appearance-selector.css .mbk-appearance:hover",
  "packages/ui/src/browser-bar/browser-bar.css :where(.browser-bar:not([data-browser-static])) .browser-expand:hover:where(.mbk-reset)",
  "packages/ui/src/controls-panel/controls-panel.css .mbk-control-alert",
  'packages/ui/src/icon-control/icon-control.css .mbk-icon-button[aria-selected="true"], .mbk-icon-button[aria-pressed="true"], .mbk-icon-button:has(> input:checked), details[open] > summary.mbk-icon-button',
  'packages/ui/src/instance-tree/instance-tree.css .mbk-instance-select[aria-pressed="true"], .mbk-instance-tree a.mbk-instance-select[aria-current="true"]',
  "packages/ui/src/tag-chip/tag-chip.css .mbk-chip.tag.active",
];

function isExemptSurface(file: string, selector: string): boolean {
  return EXEMPT_SURFACES.get(file) === selector;
}

/** Whether a rule draws a control surface that keeps a decorative hairline. */
function keepsHairline(rule: StyleRule): boolean {
  return EXEMPT_CONTROL_SURFACES.has(`${rule.file} ${rule.selector}`);
}

/** Whether a rule styles a control, by its selector or by its sheet. */
function isControlRule(rule: StyleRule): boolean {
  return CONTROL_SELECTOR.test(rule.selector) || CONTROL_SHEETS.has(rule.file);
}

function describe(reference: ColorReference): string {
  return reference.token ?? reference.literal ?? "?";
}

test("every marked boundary is visible against an adjacent colour", async () => {
  const palettesOf = await auditPalettes();
  const rules = await markedBoundaryRules();
  assert.deepEqual(
    rules.map((rule) => `${rule.file} ${rule.selector}`).sort(),
    [...AUDITED_BOUNDARIES].sort(),
    "the audit's coverage changed; confirm every added or removed rule is intended",
  );
  for (const [selector, reason] of DECORATIVE_BOUNDARIES)
    assert.ok(
      rules.some((rule) => rule.selector === selector),
      `the recorded exception ${selector} (${reason}) is not reached by the audit`,
    );
  for (const [file, selector] of EXEMPT_SURFACES)
    assert.ok(
      rules.some((rule) => rule.file === file && rule.selector === selector),
      `the exempt surface ${file} ${selector} is not reached by the audit`,
    );
  const failures: string[] = [];
  for (const rule of rules) {
    if (DECORATIVE_BOUNDARIES.has(rule.selector)) continue;
    if (isExemptSurface(rule.file, rule.selector)) continue;
    if (keepsHairline(rule)) continue;
    for (const { name, tokens } of palettesOf(rule.file))
      for (const appearance of ["light", "dark"] as const) {
        const reached = boundaryContrast(
          rule.boundary,
          rule.fill,
          tokens[appearance],
        );
        assert.ok(
          reached !== undefined,
          `${rule.file} ${rule.selector}: ${describe(rule.boundary)} is not in the ${name} ${appearance} palette`,
        );
        if (reached < 3)
          failures.push(
            `${rule.file} ${rule.selector}: ${describe(rule.boundary)} reaches only ${reached}:1 in ${name} ${appearance}`,
          );
      }
  }
  assert.deepEqual(failures, []);
});

test("every control boundary is a readable control edge", async () => {
  const palettesOf = await auditPalettes();
  const rules = await designStyleRules();
  for (const [surface, reason] of EXEMPT_CONTROL_SURFACES)
    assert.ok(
      rules.some(
        (rule) =>
          `${rule.file} ${rule.selector}` === surface &&
          isControlRule(rule) &&
          boundaryOf(rule.body) !== undefined,
      ),
      `the exempt control surface ${surface} (${reason}) is not reached by the audit`,
    );
  const failures: string[] = [];
  for (const rule of rules) {
    if (!isControlRule(rule)) continue;
    if (DECORATIVE_BOUNDARIES.has(rule.selector)) continue;
    if (keepsHairline(rule)) continue;
    const boundary = boundaryOf(rule.body);
    if (!boundary) continue;
    if (boundary.token && HAIRLINE_TOKENS.has(boundary.token)) {
      failures.push(
        `${rule.file} ${rule.selector}: ${boundary.token} is a decorative hairline; a control uses --chrome-control-edge or --mbk-sage-deep`,
      );
      continue;
    }
    for (const { name, tokens } of palettesOf(rule.file))
      for (const appearance of ["light", "dark"] as const) {
        const reached = boundaryContrast(
          boundary,
          fillOf(rule.body),
          tokens[appearance],
        );
        if (reached === undefined)
          failures.push(
            `${rule.file} ${rule.selector}: ${describe(boundary)} is not in the ${name} ${appearance} palette`,
          );
        else if (reached < 3)
          failures.push(
            `${rule.file} ${rule.selector}: ${describe(boundary)} reaches only ${reached}:1 in ${name} ${appearance}`,
          );
      }
  }
  assert.deepEqual(failures, []);
});

/**
 * Sheets that define a palette, where a literal is the definition itself:
 * the interface palette, the preview palette with its fixed device hardware,
 * and the shipped theme that the package components draw in.
 */
const PALETTE_SOURCES = new Set([
  "design.css",
  PREVIEW_SHEET,
  "packages/ui/src/theme/theme.css",
]);

test("no design stylesheet outside a palette source names a colour", async () => {
  const palette = await designPalette();
  const named = new Map<string, string>();
  for (const appearance of ["light", "dark"] as const)
    for (const [token, value] of palette[appearance])
      if (!named.has(value.toLowerCase()))
        named.set(value.toLowerCase(), `${token} (${appearance})`);
  const failures: string[] = [];
  for (const rule of await designStyleRules()) {
    if (PALETTE_SOURCES.has(rule.file)) continue;
    for (const [, literal] of rule.body.matchAll(
      /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/gu,
    )) {
      const token = named.get(literal!.toLowerCase());
      failures.push(
        token
          ? `${rule.file} ${rule.selector}: ${literal} is ${token}; use the token so it follows the appearance`
          : `${rule.file} ${rule.selector}: ${literal} has no palette role; add one or move it to a palette source`,
      );
    }
  }
  assert.deepEqual(failures, []);
});
