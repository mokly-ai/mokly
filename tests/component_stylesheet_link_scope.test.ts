import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { rendererStylesheetPaths } from "../dist/components/stylesheet_reuse.js";
import { loadConfig } from "../dist/config/load.js";
import { extractHtmlReferences } from "../dist/html_references.js";

import {
  configuredLinks,
  linkRenderer,
  linkSource,
  prepareLinkFixture,
} from "./helpers/component_link_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const link =
  '<link rel="alternate StyleSheet" href="../action.css?v=1&amp;x=2#theme">';
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
        location === "body" ? "''" : JSON.stringify(authored),
        location === "body" ? JSON.stringify(authored) : "''",
      ),
    );
    const result = await compileCatalogue(await loadConfig(fixture.root));
    const html = result.outputs.get("screens/checkout.mobile.html") as string;
    const screen = result.manifest.entries.find(
      (entry) => entry.id === "checkout",
    )!;
    assert.ok(screen.kind === "screen");
    const active = location === "head" || location === "body";
    assert.equal(
      (html.match(/href="\.\.\/action.css/g) ?? []).length,
      active ? 1 : 2,
    );
    assert.equal(
      screen.componentViews![0]!.insertedStylesheets!.length,
      active ? 0 : 1,
    );
    assert.deepEqual(extractHtmlReferences(html).resources, [
      active ? "../action.css?v=1&x=2#theme" : "../action.css",
    ]);
    const physical = await fs.realpath(
      path.join(fixture.mockupsDir, "action.css"),
    );
    assert.equal(
      rendererStylesheetPaths(
        location === "head"
          ? `<html><head>${authored}</head><body></body></html>`
          : `<html><head></head><body>${authored}</body></html>`,
        "screens/checkout.mobile.html",
        fixture.mockupsDir,
        new Set([physical]),
      ).has(physical),
      active,
    );
  });

for (const move of ["template", "body", "remove"] as const)
  test(`a transformed inserted link in ${move} has the same provenance and resource scope`, async (t) => {
    const fixture = await createFixture(linkSource, {
      extraConfig:
        'renderer: "renderer.tsx", stylesheets: [{match:"**",stylesheets:["base.css"]}], compatibility: {transformer:"transform.ts"},',
    });
    t.after(() => removeFixture(fixture));
    await prepareLinkFixture(
      fixture,
      linkRenderer(`${configuredLinks} + '<template>${link}</template>'`),
    );
    await fs.writeFile(
      path.join(fixture.root, "transform.ts"),
      `export default (input) => { let links = ""; const html = input.content.replace(/<link\\b[^>]*data-mokly-component-stylesheet[^>]*>/g, (link) => {links += link; return "";}); return ${move === "remove" ? "html" : `html.replace("</body>", ${move === "template" ? "'<template>' + links + '</template>'" : "links"} + "</body>")`}; };`,
    );
    const result = await compileCatalogue(await loadConfig(fixture.root));
    const html = result.outputs.get("screens/checkout.mobile.html") as string;
    const screen = result.manifest.entries.find(
      (entry) => entry.id === "checkout",
    )!;
    assert.ok(screen.kind === "screen");
    assert.doesNotMatch(html, /data-mokly-component-stylesheet/);
    assert.equal(
      screen.componentViews![0]!.insertedStylesheets!.length,
      move === "body" ? 1 : 0,
    );
    assert.deepEqual(
      extractHtmlReferences(html).resources,
      move === "body" ? ["../base.css", "../action.css"] : ["../base.css"],
    );
  });

test("body aliases keep all authored links and prefer configured order", async (t) => {
  const fixture = await createFixture(linkSource, {
    extraConfig: 'renderer:"renderer.tsx",stylesheets:[],',
  });
  t.after(() => removeFixture(fixture));
  await prepareLinkFixture(
    fixture,
    linkRenderer(
      "''",
      JSON.stringify(
        '<link rel="stylesheet" href="../alias.css"><link rel="stylesheet" href="../action.css">',
      ),
    ),
  );
  await fs.symlink("action.css", path.join(fixture.mockupsDir, "alias.css"));
  const result = await compileCatalogue(await loadConfig(fixture.root));
  const html = result.outputs.get("screens/checkout.mobile.html") as string;
  assert.deepEqual(extractHtmlReferences(html).resources, [
    "../alias.css",
    "../action.css",
  ]);
  const physical = await fs.realpath(
    path.join(fixture.mockupsDir, "action.css"),
  );
  const scan = (configured: string[]) =>
    rendererStylesheetPaths(
      html,
      "screens/checkout.mobile.html",
      fixture.mockupsDir,
      new Set([physical]),
      configured,
    ).get(physical);
  assert.equal(scan([]), "alias.css");
  assert.equal(scan(["../action.css", "../alias.css"]), "action.css");
  const screen = result.manifest.entries.find(
    (entry) => entry.id === "checkout",
  )!;
  assert.ok(screen.kind === "screen");
  assert.deepEqual(screen.componentViews![0]!.insertedStylesheets, []);
});
