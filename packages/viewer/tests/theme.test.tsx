import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { embeddedStyles } from "../scripts/styles.mjs";
import { readCatalogue } from "../src/catalogue/reader.js";
import { SHELL_CSS } from "../src/shell/css.js";
import {
  viewerCatalogue,
  viewerContext,
  viewerView,
} from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";
import { renderViewer } from "../src/viewer/server.js";
import { VIEWER_CSS } from "../src/viewer/styles.js";

/** Exactly what a host receives, scoped away from its own document. */
const EMBEDDED_CSS: string = embeddedStyles(SHELL_CSS, VIEWER_CSS);
const ACCENT_OVERRIDES = new Map([
  ["--mokly-accent", "--_mokly-private-accent-default"],
  ["--mokly-accent-contrast", "--_mokly-private-accent-contrast-default"],
  ["--mokly-accent-soft", "--_mokly-private-accent-soft-default"],
]);

const fixture = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

function render(theme?: "auto" | "light" | "dark"): string {
  return renderViewer({
    viewerId: "theme-test",
    catalogue: fixture,
    baseUrl: "https://catalogue.example",
    ...(theme ? { theme } : {}),
  });
}

test("an explicit theme is present in the initial markup", () => {
  for (const theme of ["light", "dark"] as const)
    assert.match(
      render(theme),
      new RegExp(`class="mbk mokly-viewer"[^>]*data-mokly-theme="${theme}"`),
      theme,
    );
});

test("an omitted theme renders Auto, without guessing a scheme", () => {
  const html = render();
  assert.match(html, /data-mokly-theme="auto"/);
  assert.doesNotMatch(html, /data-mokly-theme="(light|dark)"/);
});

test("theme is independent of the preview colour scheme", () => {
  const html = renderViewer({
    viewerId: "theme-test",
    catalogue: fixture,
    baseUrl: "https://catalogue.example",
    theme: "dark",
    defaultSelection: { colorScheme: "light" },
  });
  assert.match(html, /data-mokly-theme="dark"/);
  assert.match(html, /data-mokly-color-scheme="light"/);
});

test("a full-document render applies the theme prop over its host context", () => {
  const catalogue = viewerCatalogue(fixture);
  const context = {
    ...viewerContext(fixture, defaultSelection),
    embedded: false,
    theme: "light" as const,
  };
  const host = {
    catalogue,
    context,
    view: viewerView(catalogue, defaultSelection),
  };
  const props = {
    viewerId: "theme-test",
    catalogue: fixture,
    baseUrl: "https://catalogue.example",
  };

  assert.match(
    renderViewer({ ...props, theme: "dark" }, host),
    /data-mokly-theme="dark"/,
  );
  assert.match(renderViewer(props, host), /data-mokly-theme="light"/);
});

test("Auto resolves through CSS, so no script decides the appearance", () => {
  assert.match(
    EMBEDDED_CSS,
    /@media \(prefers-color-scheme: dark\) \{\s*:scope\[data-mokly-theme="auto"\]/,
    "Auto has no prefers-color-scheme rule",
  );
  assert.match(EMBEDDED_CSS, /:scope\[data-mokly-theme="dark"\] \{/);
  assert.doesNotMatch(render("dark"), /<script/);
});

test("the dark palette is selected by the root, never by the host document", () => {
  // Every themed rule a host receives is scoped to the viewer root, so the
  // host page keeps its own appearance and a sibling root is unaffected.
  const scoped = EMBEDDED_CSS.slice(
    EMBEDDED_CSS.indexOf("@scope (.mokly-viewer)"),
  );
  for (const [, selector] of EMBEDDED_CSS.matchAll(
    /\n([^{}\n]*data-mokly-theme[^{}\n]*)\{/g,
  )) {
    assert.match(
      selector!,
      /:scope\[data-mokly-theme/u,
      `${selector!.trim()} is not anchored to the viewer root`,
    );
    assert.ok(scoped.includes(selector!), `${selector!.trim()} escapes @scope`);
  }
  assert.doesNotMatch(EMBEDDED_CSS, /^\s*(html|body)[\s,{]/mu);
});

test("both appearances define exactly the same shell roles", () => {
  const roles = (source: string): string[] =>
    [...source.matchAll(/(--[a-z0-9-]+):/g)].map((match) => match[1]!).sort();
  const light = /:root \{([^}]*)\}/.exec(SHELL_CSS);
  const dark = /:root\[data-mokly-theme="dark"\] \{([^}]*)\}/.exec(SHELL_CSS);
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
  // The scoped shell drops the public accent declarations so a host value on
  // an ancestor can inherit in. The fallback behind each use must therefore
  // follow the appearance, or a dark root would paint the Light accent.
  assert.deepEqual(
    [
      ...new Set(
        [...SHELL_CSS.matchAll(/(--mokly-[a-z0-9-]+):/g)].map(
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
      `${name} is declared in the scoped shell, shadowing a host override`,
    );
    assert.match(
      EMBEDDED_CSS,
      new RegExp(`var\\(${name}, var\\(${fallback}\\)\\)`),
      `${name} has no scheme-aware fallback`,
    );
  }
  for (const [block, accent] of [
    [/:scope \{([\s\S]*?)\}/, "#4f7864"],
    [/:scope\[data-mokly-theme="dark"\] \{([\s\S]*?)\}/, "#86b79b"],
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
  const css = SHELL_CSS.replace(/\s+/g, " ");
  // A frame declares the scheme of what it shows, so a native control or
  // scrollbar inside a preview follows the preview and not the interface.
  assert.ok(
    css.includes(".mbk-frag { color-scheme: light; }"),
    "a frame has no default preview color-scheme",
  );
  assert.ok(
    css.includes(
      'body[data-mokly-color-scheme="dark"] ' +
        ":is(.mbk-frame-wrap, .mbk-flow-screen):not([data-color-scheme-fallback]) " +
        ".mbk-frag { color-scheme: dark; }",
    ),
    "a dark preview frame does not declare dark",
  );
  // It comes from the stylesheet, not an assignment after the element exists,
  // so it is in force before the frame loads and survives a source swap.
  assert.doesNotMatch(SHELL_CSS, /style="[^"]*color-scheme/u);
});

test("a comparison canvas takes an opaque base from its preview scheme", () => {
  const css = SHELL_CSS.replace(/\s+/g, " ");
  assert.ok(
    css.includes(
      ".mb-pane-doc { width: 100%; background: var(--mbk-screen-bg); }",
    ),
    "a comparison canvas has no opaque base",
  );
  assert.ok(
    css.includes(
      'body[data-mokly-color-scheme="dark"] ' +
        ".mb-pane-doc:not([data-color-scheme-fallback]) " +
        "{ background: var(--mbk-dark-screen-bg); }",
    ),
    "a dark comparison canvas keeps the light base",
  );
});

test("forced colours are left to the system in both appearances", () => {
  // A reader who forces their own colours must keep them, so no rule opts an
  // element out of the substitution in either appearance.
  assert.doesNotMatch(SHELL_CSS, /forced-color-adjust:\s*none/u);
  assert.doesNotMatch(VIEWER_CSS, /forced-color-adjust:\s*none/u);
});
