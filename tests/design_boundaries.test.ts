import assert from "node:assert/strict";
import test from "node:test";

import { contrast, designPalette } from "./helpers/design_palette.js";
import {
  boundaryOf,
  designStyleRules,
  fillOf,
  type ColorReference,
} from "./helpers/design_styles.js";

/**
 * Selectors that mark a control state. A boundary drawn only in one of these
 * states is the state's own indicator, so it carries the 3:1 requirement.
 */
const STATE_SELECTOR =
  /:hover|:focus|:checked|:has\(input:checked\)|:disabled|\[open\]|\.active|aria-pressed|aria-current/u;

/**
 * Fills that mark a selected, active or status surface, derived from the
 * palette so a new accent or status role joins the audit without an edit here.
 */
function markedFillTokens(tokens: Map<string, string>): string[] {
  return [...tokens.keys()].filter(
    (token) =>
      token.startsWith("--mbk-accent-") ||
      token === "--mbk-danger-bg" ||
      token === "--chrome-disabled-bg" ||
      (token.startsWith("--mbk-status-") && token.endsWith("-bg")),
  );
}

/** Selectors naming a control primitive, whose boundary is a control edge. */
const CONTROL_SELECTOR =
  /\bbutton\b|\binput\b|\bselect\b|\bsummary\b|\btextarea\b|\.ce-action|\.ce-button|\.ce-icon-control|\.mbk-seg|\.mbk-appearance|\.ce-sheet-expand|\.mbk-chip:is\(a\)/u;

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
  [".ce-added", "a label naming its own state in 7.08:1 ink"],
  [".ce-changed", "a label naming its own state in 5.62:1 ink"],
  [".ce-removed", "a label naming its own state in 5.73:1 ink"],
  [".ce-control-alert", "a label naming its own state in 5.97:1 ink"],
  [".ce-action:disabled", "WCAG exempts a disabled control"],
]);

/**
 * Surfaces that draw a hairline inside a state selector because the state
 * belongs to a descendant, not to a control. Each entry must be reached by the
 * audit, so a future control cannot quietly inherit the exemption.
 */
const EXEMPT_SURFACES = new Map([
  [
    "design-library/inspector/inspector.css",
    ".ce-design .mbk-shell--mobile .ce-inspector:has(> details[open])",
  ],
]);

/**
 * Every rule the audit collects, so a failure names the rule that appeared or
 * vanished instead of only reporting that the total moved.
 */
const AUDITED_BOUNDARIES = [
  "design-component-controls.css .ce-action--quiet",
  "design-component-controls.css .ce-control-alert",
  'design-component-inspection.css .ce-button[aria-pressed="true"]',
  "design-components.css .ce-action:disabled",
  "design-components.css .ce-badge",
  "design-components.css .ce-design a:focus-visible, .ce-design button:focus-visible, .ce-design summary:focus-visible, .ce-design input:focus-visible, .ce-design select:focus-visible",
  "design-components.css .ce-variants a[aria-current]",
  "design-library/chrome/appearance-selector.css .mbk-appearance:focus-within",
  "design-library/chrome/appearance-selector.css .mbk-appearance:hover",
  "design-library/controls/change-status.css .ce-added",
  "design-library/controls/change-status.css .ce-changed",
  "design-library/controls/change-status.css .ce-removed",
  "design-library/controls/tag-chip.css .mbk-chip.tag:is(a).active",
  "design-library/controls/view-controls.css .ce-icon-control:focus-within",
  "design-library/controls/view-controls.css .ce-icon-control:hover, .ce-icon-control:has(input:checked)",
  "design-library/inspector/inspector.css .ce-design .mbk-shell--mobile .ce-inspector:has(> details[open])",
  "design-library/inspector/inspector.css .ce-inspector > details[open] > summary",
  "design-library/inspector/inspector.css .ce-sheet-expand:focus-visible",
  "design-stage.css .mbk-chip:is(a):focus-visible",
];

function isExemptSurface(file: string, selector: string): boolean {
  return EXEMPT_SURFACES.get(file) === selector;
}

/** Resolves a reference to the colour it paints in one appearance. */
function resolve(
  reference: ColorReference,
  tokens: Map<string, string>,
): string | undefined {
  return reference.token ? tokens.get(reference.token) : reference.literal;
}

function describe(reference: ColorReference): string {
  return reference.token ?? reference.literal ?? "?";
}

/**
 * A boundary sits between its own fill and the surface around it, so it only
 * has to reach 3:1 against one of them to read as an edge.
 */
function boundaryContrast(
  boundary: ColorReference,
  fill: ColorReference | undefined,
  tokens: Map<string, string>,
): number | undefined {
  const edge = resolve(boundary, tokens);
  if (!edge) return undefined;
  const behind = fill ? resolve(fill, tokens) : undefined;
  return Math.max(
    behind ? contrast(edge, behind) : 0,
    contrast(edge, tokens.get("--chrome-surface")!),
  );
}

/**
 * Rules whose boundary is a control or state indicator: either the selector
 * names a state, or the rule fills itself with a marked surface.
 */
async function markedBoundaryRules() {
  const palette = await designPalette();
  const marked = new Set(
    markedFillTokens(palette.light).flatMap((token) => [
      token,
      palette.light.get(token)?.toLowerCase() ?? token,
      palette.dark.get(token)?.toLowerCase() ?? token,
    ]),
  );
  return (await designStyleRules()).flatMap((rule) => {
    const boundary = boundaryOf(rule.body);
    if (!boundary) return [];
    const fill = fillOf(rule.body);
    const fillMark = fill?.token ?? fill?.literal?.toLowerCase();
    if (
      !STATE_SELECTOR.test(rule.selector) &&
      !(fillMark && marked.has(fillMark))
    )
      return [];
    return [{ ...rule, boundary, fill }];
  });
}

test("every marked boundary is visible against an adjacent colour", async () => {
  const palette = await designPalette();
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
    for (const appearance of ["light", "dark"] as const) {
      const tokens = palette[appearance];
      const reached = boundaryContrast(rule.boundary, rule.fill, tokens);
      assert.ok(
        reached !== undefined,
        `${rule.file} ${rule.selector}: ${describe(rule.boundary)} is not in the ${appearance} palette`,
      );
      if (reached < 3)
        failures.push(
          `${rule.file} ${rule.selector}: ${describe(rule.boundary)} reaches only ${reached}:1 in ${appearance}`,
        );
    }
  }
  assert.deepEqual(failures, []);
});

test("every control boundary is a readable control edge", async () => {
  const palette = await designPalette();
  const failures: string[] = [];
  for (const rule of await designStyleRules()) {
    if (!CONTROL_SELECTOR.test(rule.selector)) continue;
    if (DECORATIVE_BOUNDARIES.has(rule.selector)) continue;
    const boundary = boundaryOf(rule.body);
    if (!boundary) continue;
    if (boundary.token && HAIRLINE_TOKENS.has(boundary.token)) {
      failures.push(
        `${rule.file} ${rule.selector}: ${boundary.token} is a decorative hairline; a control uses --chrome-control-edge or --mbk-sage-deep`,
      );
      continue;
    }
    for (const appearance of ["light", "dark"] as const) {
      const reached = boundaryContrast(
        boundary,
        fillOf(rule.body),
        palette[appearance],
      );
      if (reached === undefined)
        failures.push(
          `${rule.file} ${rule.selector}: ${describe(boundary)} is not in the ${appearance} palette`,
        );
      else if (reached < 3)
        failures.push(
          `${rule.file} ${rule.selector}: ${describe(boundary)} reaches only ${reached}:1 in ${appearance}`,
        );
    }
  }
  assert.deepEqual(failures, []);
});

/**
 * Sheets that define a palette, where a literal is the definition itself:
 * the interface palette, the preview palette with its fixed device hardware,
 * and the component explorer's scoped palette for depicted content.
 */
const PALETTE_SOURCES = new Set([
  "design.css",
  "design-stage.css",
  "design-component-view.css",
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
