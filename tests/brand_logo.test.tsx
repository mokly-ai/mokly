import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SHELL_CSS } from "../packages/viewer/dist/shell/css.js";
import { BrandIcon } from "../packages/viewer/dist/shell/icons.js";

import { designDocument } from "./helpers/design_catalogue.js";
import { repositoryRoot } from "./helpers/fixture.js";

/** The mark of the published Mokly logo on its 32-unit grid, at 24px. */
const LOGO_MARK =
  '<svg aria-hidden="true" height="24" viewBox="0 0 32 32" width="24">' +
  '<rect fill="currentColor" height="21" opacity="0.3" rx="4" width="20" x="3" y="3"></rect>' +
  '<rect fill="currentColor" height="21" rx="4" width="20" x="9" y="8"></rect>' +
  '<path class="mbk-mark-rules" d="M14 15h10M14 20h7" fill="none" ' +
  'stroke-linecap="round" stroke-width="2"></path></svg>';

const designCss = (file: string) =>
  readFile(path.join(repositoryRoot, "examples/basic/generated", file), "utf8");

function token(css: string, name: string): string | undefined {
  return css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
}

/** The declarations of the rule whose whole selector is `selector`. */
function declarations(css: string, selector: string): Map<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = css.match(new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`))?.[1];
  assert.ok(body, `missing ${selector}`);
  return new Map(
    body
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const colon = declaration.indexOf(":");
        return [
          declaration.slice(0, colon).trim(),
          declaration.slice(colon + 1).trim(),
        ];
      }),
  );
}

test("the shell draws the published Mokly logo mark", () => {
  assert.equal(renderToStaticMarkup(<BrandIcon />), LOGO_MARK);
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: design headers draw the shell's logo`, async () => {
    const { html } = await designDocument("design-browse-home", viewport);
    const brand = html.match(
      /class="mbk-mark" aria-hidden="true">(<svg[\s\S]*?<\/svg>)<\/span>((?:<span class="mbk-name">[^<]*<\/span>)?)<\/a>/,
    );
    assert.ok(brand, `${viewport} brand`);
    assert.equal(brand[1], LOGO_MARK);
    assert.equal(
      brand[2],
      viewport === "desktop" ? '<span class="mbk-name">mokly.</span>' : "",
    );
  });
}

test("the shell and design catalogue share the logo colors and wordmark type", async () => {
  const [tokens, topBar] = await Promise.all([
    designCss("design.css"),
    designCss("design-library/chrome/top-bar.css"),
  ]);
  assert.equal(token(SHELL_CSS, "--chrome-brand"), "#2f5945");
  assert.equal(token(SHELL_CSS, "--chrome-surface"), "#ffffff");
  assert.equal(
    token(SHELL_CSS, "--serif"),
    'Georgia, "Times New Roman", serif',
  );
  for (const name of ["--chrome-brand", "--chrome-surface", "--serif"])
    assert.equal(token(tokens, name), token(SHELL_CSS, name), name);

  for (const css of [SHELL_CSS, topBar]) {
    const mark = declarations(css, ".mbk-mark");
    assert.equal(mark.get("color"), "var(--chrome-brand)");
    assert.equal(mark.get("width"), "24px");
    assert.equal(mark.get("height"), "24px");
    assert.equal(mark.get("flex-shrink"), "0");
    assert.equal(mark.has("background"), false);
    assert.deepEqual(
      [...declarations(css, ".mbk-mark-rules")],
      [["stroke", "var(--chrome-surface)"]],
    );
    const name = declarations(css, ".mbk-name");
    assert.equal(name.get("font-family"), "var(--serif)");
    assert.equal(name.get("font-size"), "20px");
    assert.equal(name.get("font-weight"), "400");
    assert.equal(name.get("white-space"), "nowrap");
  }
});
