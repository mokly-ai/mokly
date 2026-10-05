import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { parseHtmlLinks } from "../dist/html_links.js";
import { extractHtmlReferences } from "../dist/html_references.js";

import {
  linkRenderer,
  linkSource,
  prepareLinkFixture,
} from "./helpers/component_link_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const attribute = "data-mokly-component-stylesheet";

test("shared discovery keeps active locations, UTF-16 spans and decoded attributes", () => {
  const head = '<link rel="alternate\tStyleSheet" href="a.css?x=1&amp;y=2">';
  const body = '<link rel="stylesheet" href="b.css">';
  const inert = '<link rel="stylesheet" href="inert.css">';
  const html = `<html><head><title>😀</title>${head}<template>${inert}</template><noscript>${inert}</noscript></head><body><!--${inert}--><script>${JSON.stringify(inert)}</script>${body}</body></html>`;
  const { links } = parseHtmlLinks(html);
  assert.deepEqual(
    links.map((link) => [
      link.scope,
      link.stylesheet,
      link.attributes.get("href"),
      html.slice(link.location.startOffset, link.location.endOffset),
    ]),
    [
      ["head", true, "a.css?x=1&y=2", head],
      ["body", true, "b.css", body],
    ],
  );
  assert.deepEqual(extractHtmlReferences(html).resources, [
    "a.css?x=1&y=2",
    "b.css",
  ]);
});

for (const token of [
  "authored",
  "unknown",
  "duplicate",
  "wrong-element",
  "reassigned",
] as const)
  test(`reserved ${token} tokens are still rejected inside templates`, async (t) => {
    const fixture = await createFixture(linkSource, {
      extraConfig: `renderer: "renderer.tsx", stylesheets: [], ${token === "authored" ? "" : 'compatibility: {transformer:"transform.ts"},'}`,
    });
    t.after(() => removeFixture(fixture));
    await prepareLinkFixture(
      fixture,
      linkRenderer(
        token === "authored"
          ? JSON.stringify(
              `<template><link rel="stylesheet" href="../action.css" ${attribute}="0"></template>`,
            )
          : "''",
      ),
    );
    if (token !== "authored") {
      const replace =
        token === "unknown"
          ? `link.replace('${attribute}="0"', '${attribute}="99"')`
          : token === "wrong-element"
            ? 'link.replace("<link", "<meta")'
            : token === "reassigned"
              ? 'link.replace("action.css", "base.css")'
              : "link";
      await fs.writeFile(
        path.join(fixture.root, "transform.ts"),
        `export default (input) => input.content.replace(/<link\\b[^>]*${attribute}[^>]*>/g, (link) => ${token === "duplicate" ? "link + " : ""}'<template>' + ${replace} + '</template>');`,
      );
    }
    await assert.rejects(
      compileCatalogue(await loadConfig(fixture.root)),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "build-invalid" &&
        error.message.includes(attribute),
    );
  });
