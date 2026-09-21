import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { embeddedStyles } from "../scripts/styles.mjs";
import { readCatalogue } from "../src/catalogue/reader.js";
import { SHELL_CSS } from "../src/shell/css.js";
import { renderViewer } from "../src/viewer/server.js";
import { VIEWER_CSS } from "../src/viewer/styles.js";

/** Exactly what a host receives, scoped away from its own document. */
const EMBEDDED_CSS: string = embeddedStyles(SHELL_CSS, VIEWER_CSS);

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
    catalogue: fixture,
    baseUrl: "https://catalogue.example",
    theme: "dark",
    defaultSelection: { colorScheme: "light" },
  });
  assert.match(html, /data-mokly-theme="dark"/);
  assert.match(html, /data-mokly-color-scheme="light"/);
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
