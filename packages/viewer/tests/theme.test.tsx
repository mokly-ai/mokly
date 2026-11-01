import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";

import { embeddedMarkup } from "./presentation_v7_helpers.js";
import { printSelector, styleRules } from "./style_rules.js";

/** The built stylesheets that a delivery and an embedded host receive. */
const [STANDALONE_CSS, EMBEDDED_CSS] = await Promise.all([
  fs.readFile(new URL("../dist/shell.css", import.meta.url), "utf8"),
  fs.readFile(new URL("../dist/styles.css", import.meta.url), "utf8"),
]);
const ACCENT_OVERRIDES = new Map([
  ["--mokly-accent", "--_mokly-private-accent-default"],
  ["--mokly-accent-contrast", "--_mokly-private-accent-contrast-default"],
  ["--mokly-accent-soft", "--_mokly-private-accent-soft-default"],
]);

function render(theme?: "auto" | "light" | "dark"): string {
  return embeddedMarkup(theme ? { theme } : {});
}

test("an explicit theme is present in the initial markup", () => {
  for (const theme of ["light", "dark"] as const)
    assert.match(
      render(theme),
      new RegExp(
        `class="mbk mokly-viewer mbk-reset"[^>]*data-mokly-theme="${theme}"`,
      ),
      theme,
    );
});

test("an omitted theme renders Auto, without guessing a scheme", () => {
  const html = render();
  assert.match(html, /data-mokly-theme="auto"/);
  assert.doesNotMatch(html, /data-mokly-theme="(light|dark)"/);
});

test("theme is independent of the preview colour scheme", () => {
  const html = embeddedMarkup({
    theme: "dark",
    defaultSelection: { colorScheme: "light" },
  });
  assert.match(html, /data-mokly-theme="dark"/);
  assert.match(html, /data-mokly-color-scheme="light"/);
});

test("Auto resolves through CSS, so no script decides the appearance", () => {
  assert.match(
    EMBEDDED_CSS,
    /@media \(prefers-color-scheme: dark\) \{\s*\.mbk\[data-mokly-theme="auto"\]/,
    "Auto has no prefers-color-scheme rule",
  );
  assert.match(EMBEDDED_CSS, /\n\.mbk\[data-mokly-theme="dark"\][^{]*\{/);
  assert.doesNotMatch(render("dark"), /<script/);
});

test("the dark palette is selected by the root, never by the host document", () => {
  // Every themed rule a host receives selects a shell root that states its
  // appearance, or the standalone stub's own document, so the host page keeps
  // its own appearance and a sibling root is unaffected.
  const themed = styleRules(EMBEDDED_CSS)
    .selectors.map(printSelector)
    .filter((selector) => selector.includes("data-mokly-theme"));
  assert.ok(themed.length >= 5, `only ${themed.length} themed selectors`);
  for (const selector of themed)
    assert.match(
      selector,
      /^\.mbk(?:-document)?(?:\[data-mokly-theme="(?:auto|dark)"\]|:not\(\[data-mokly-theme\]\))$/u,
      `${selector} is not anchored to a shell root`,
    );
  assert.doesNotMatch(EMBEDDED_CSS, /^\s*(html|body)[\s,{]/mu);
});

test("both appearances define exactly the same shell roles", () => {
  const roles = (source: string): string[] =>
    [...source.matchAll(/(--[a-z0-9-]+):/g)].map((match) => match[1]!).sort();
  const light = /\n\.mbk,\s*\.mbk-document \{([^}]*)\}/.exec(STANDALONE_CSS);
  const dark =
    /\n\.mbk\[data-mokly-theme="dark"\],\s*\.mbk-document\[data-mokly-theme="dark"\] \{([^}]*)\}/.exec(
      STANDALONE_CSS,
    );
  assert.ok(light?.[1] && dark?.[1], "the shell defines both appearances");
  const themed = roles(dark[1]);
  assert.ok(themed.length > 20, `only ${themed.length} dark roles`);
  for (const role of themed)
    assert.ok(
      roles(light[1]).includes(role),
      `${role} is dark-only; every role belongs to both appearances`,
    );
});

test("only the three public accent overrides survive from a host", () => {
  // The embedded stylesheet drops the public accent declarations so a host
  // value on an ancestor can inherit in. The fallback behind each use must therefore
  // follow the appearance, or a dark root would paint the Light accent.
  assert.deepEqual(
    [
      ...new Set(
        [...STANDALONE_CSS.matchAll(/(--mokly-[a-z0-9-]+):/g)].map(
          (match) => match[1]!,
        ),
      ),
    ].sort(),
    [...ACCENT_OVERRIDES.keys()].sort(),
  );
  for (const [name, fallback] of ACCENT_OVERRIDES) {
    assert.doesNotMatch(
      EMBEDDED_CSS,
      new RegExp(`^\\s*${name}: (?!var\\()`, "mu"),
      `${name} is declared in the embedded shell, shadowing a host override`,
    );
    assert.match(
      EMBEDDED_CSS,
      new RegExp(`var\\(${name}, var\\(${fallback}\\)\\)`),
      `${name} has no scheme-aware fallback`,
    );
  }
  for (const [block, accent] of [
    [/\n\.mbk, \.mbk-document \{([\s\S]*?)\}/, "#4f7864"],
    [
      /\n\.mbk\[data-mokly-theme="dark"\], \.mbk-document\[data-mokly-theme="dark"\] \{([\s\S]*?)\}/,
      "#86b79b",
    ],
  ] as const) {
    const declarations = block.exec(EMBEDDED_CSS)?.[1];
    assert.ok(declarations, `${block} is missing`);
    assert.match(
      declarations,
      new RegExp(`--_mokly-private-accent-default: ${accent};`),
      `the ${accent} default is missing`,
    );
  }
});

test("every frame carries its own preview color-scheme", () => {
  const css = STANDALONE_CSS.replace(/\s+/g, " ");
  // A frame declares the scheme of what it shows, so a native control or
  // scrollbar inside a preview follows the preview and not the interface.
  assert.match(
    css,
    /\.mbk-frag \{[^}]*color-scheme: light;/,
    "a frame has no default preview color-scheme",
  );
  assert.match(
    css,
    /\[data-preview-color-scheme="dark"\] \.mbk-frag \{[^}]*color-scheme: dark;/,
    "a dark preview frame does not declare dark",
  );
  // It comes from the stylesheet, not an assignment after the element exists,
  // so it is in force before the frame loads and survives a source swap.
  for (const styles of [STANDALONE_CSS, EMBEDDED_CSS])
    assert.doesNotMatch(styles, /style="[^"]*color-scheme/u);
});

test("a comparison canvas takes an opaque base from its preview scheme", () => {
  const css = STANDALONE_CSS.replace(/\s+/g, " ");
  assert.ok(
    css.includes(
      ".mb-pane-doc:where(.mbk-reset) { background-color: var(--mbk-screen-bg); " +
        "background-image: linear-gradient( var(--mbk-comparison-canvas, transparent), " +
        "var(--mbk-comparison-canvas, transparent) ); }",
    ),
    "a comparison canvas has no opaque base under its document's canvas",
  );
  assert.ok(
    css.includes(
      '[data-preview-color-scheme="dark"] .mb-pane-doc:where(.mbk-reset) ' +
        "{ background-color: var(--mbk-dark-screen-bg); }",
    ),
    "a dark comparison canvas keeps the light base",
  );
  assert.ok(
    css.includes(
      '[data-preview-color-scheme="dark"] .mb-viewport:where(.mbk-reset) { color-scheme: dark; }',
    ),
    "a dark comparison viewport keeps light scrollbars",
  );
});

test("forced colours are left to the system in both appearances", () => {
  // A reader who forces their own colours must keep them, so no rule opts an
  // element out of the substitution in either appearance.
  for (const styles of [STANDALONE_CSS, EMBEDDED_CSS])
    assert.doesNotMatch(styles, /forced-color-adjust:\s*none/u);
});
