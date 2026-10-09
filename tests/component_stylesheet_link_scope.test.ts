import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { rendererStylesheetPaths } from "../dist/components/stylesheet_reuse.js";
import { loadConfig } from "../dist/config/load.js";
import { extractHtmlReferences } from "../dist/html_references.js";

import {
  linkRenderer,
  linkSource,
  prepareLinkFixture,
} from "./helpers/component_link_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const link =
  '<link rel="alternate StyleSheet" href="../../action.css?v=1&amp;x=2#theme">';
for (const location of ["head", "body", "template", "noscript"] as const)
  test(`declared stylesheet reuse follows active ${location} links`, async (t) => {
    const authored =
      location === "template" || location === "noscript"
        ? `<${location}>${link}</${location}>`
        : link;
    const fixture = await createFixture(linkSource, {
      extraConfig: 'renderer: "renderer.tsx", stylesheets: [],',
    });
    t.after(() => removeFixture(fixture));
    await prepareLinkFixture(
      fixture,
      linkRenderer(
        location === "body" ? "''" : relativeAuthored(authored),
        location === "body" ? relativeAuthored(authored) : "''",
      ),
    );
    const result = await compileCatalogue(await loadConfig(fixture.root));
    const html = result.outputs.get("checkout/index.mobile.html") as string;
    const screen = result.manifest.entries.find(
      (entry) => entry.path === "checkout",
    )!;
    assert.ok(screen.kind === "screen");
    const active = location === "head" || location === "body";
    assert.equal(
      (html.match(/href="\.\.\/\.\.\/action.css/g) ?? []).length,
      active ? 1 : 2,
    );
    assert.equal(
      screen.componentViews![0]!.insertedStylesheets!.length,
      active ? 0 : 1,
    );
    assert.deepEqual(extractHtmlReferences(html).resources, [
      active ? "../../action.css?v=1&x=2#theme" : "../../action.css",
    ]);
    const physical = await fs.realpath(
      path.join(fixture.mockupsDir, "action.css"),
    );
    assert.equal(
      rendererStylesheetPaths(
        location === "head"
          ? `<html><head>${authored}</head><body></body></html>`
          : `<html><head></head><body>${authored}</body></html>`,
        "mokly-generated/checkout/index.mobile.html",
        fixture.mockupsDir,
        new Set([physical]),
      ).has(physical),
      active,
    );
  });

test("body stylesheet links retain authored order and refuse symlinked aliases", async (t) => {
  const fixture = await createFixture(linkSource, {
    extraConfig: 'renderer:"renderer.tsx",stylesheets:[],',
  });
  t.after(() => removeFixture(fixture));
  await prepareLinkFixture(
    fixture,
    linkRenderer(
      "''",
      relativeAuthored(
        '<link rel="stylesheet" href="../../alias.css"><link rel="stylesheet" href="../../action.css">',
      ),
    ),
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "alias.css"),
    ".action{color:red}",
  );
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const html = result.outputs.get("checkout/index.mobile.html") as string;
  assert.deepEqual(extractHtmlReferences(html).resources, [
    "../../alias.css",
    "../../action.css",
  ]);
  const physical = await fs.realpath(
    path.join(fixture.mockupsDir, "action.css"),
  );
  const scan = (configured: string[]) =>
    rendererStylesheetPaths(
      html,
      "mokly-generated/checkout/index.mobile.html",
      fixture.mockupsDir,
      new Set([physical]),
      configured,
    ).get(physical);
  assert.equal(scan([]), "action.css");
  assert.equal(scan(["../../action.css", "../../alias.css"]), "action.css");
  const screen = result.manifest.entries.find(
    (entry) => entry.path === "checkout",
  )!;
  assert.ok(screen.kind === "screen");
  assert.deepEqual(screen.componentViews![0]!.insertedStylesheets, []);
  await fs.unlink(path.join(fixture.mockupsDir, "alias.css"));
  await fs.symlink("action.css", path.join(fixture.mockupsDir, "alias.css"));
  await assert.rejects(compileCatalogue(await loadConfig(fixture.root)), {
    code: "build-invalid",
    message:
      "[mokly/build-invalid] document links and resources are invalid:\n" +
      [
        "alias.css",
        "mokly-generated/action/default/index.desktop.html",
        "mokly-generated/action/default/index.mobile.html",
        "mokly-generated/checkout/index.desktop.html",
        "mokly-generated/checkout/index.mobile.html",
        "mokly-generated/toolbar/default/index.desktop.html",
        "mokly-generated/toolbar/default/index.mobile.html",
      ]
        .map((route) =>
          route === "alias.css"
            ? "- alias.css: protected target alias.css: is a symlink or non-regular file"
            : `- ${route}: protected target ${route.includes("/checkout/") ? "../../" : "../../../"}alias.css: is a symlink or non-regular file`,
        )
        .join("\n"),
  });
});

/** Rebase the same authored local links for the screen and deeper saved-view paths. */
function relativeAuthored(html: string): string {
  return `${JSON.stringify(html)}.replaceAll('href="../../', 'href="' + '../'.repeat(input.entry.path.split('/').length + 1))`;
}
