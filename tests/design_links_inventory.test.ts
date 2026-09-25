import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { parse } from "parse5";

import {
  appearanceModes,
  welcomeModes,
} from "../examples/basic/entries/design/parts/navigation_states.js";

import {
  attribute,
  byClass,
  designCatalogue,
  elements,
} from "./helpers/design_catalogue.js";
import { repositoryRoot } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

test("no design route doubles as a directory holding another design route", async () => {
  const { manifest } = await designCatalogue;
  const routes = manifest.entries.flatMap((entry) =>
    entry.kind === "screen" && entry.id.startsWith("design-")
      ? [entry.route]
      : [],
  );
  const directories = new Set(
    routes.flatMap((route) => {
      const segments = route.split("/").slice(0, -1);
      return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
    }),
  );
  for (const route of routes)
    assert.ok(
      !directories.has(route.replace(/\.html$/, "")),
      `${route} collides with a collection segment of the same name`,
    );
});

test("the canonical documented inventory exactly matches the complete design registry", async () => {
  const { manifest } = await designCatalogue;
  const spec = (
    await Promise.all(
      [
        "docs/protocol/mokly-shell-design.md",
        "docs/protocol/mokly-component-design.md",
        "docs/protocol/mokly-component-inspector-design.md",
        "docs/protocol/mokly-component-controls-design.md",
      ].map((file) => fs.readFile(path.join(repositoryRoot, file), "utf8")),
    )
  ).join("\n");
  const documented = [
    ...spec.matchAll(/\|\s*`(design-[^`]+)`\s*\|\s*`([^`]+)`/g),
  ]
    .map((match) => `${match[1]} ${match[2]}`)
    .sort();
  const actual = manifest.entries
    .flatMap((entry) =>
      entry.kind === "screen" && entry.id.startsWith("design-")
        ? [`${entry.id} ${entry.route}`]
        : [],
    )
    .sort();
  assert.deepEqual(documented, actual);
});

/** Comparison families whose members must agree on the schemes they publish. */
const COMPARISON_FAMILIES = [
  Object.values(welcomeModes),
  Object.values(appearanceModes),
];

test("a dark fragment's links stay dark wherever the target has a dark render", async () => {
  const { manifest, outputs } = await designCatalogue;
  const designs = manifest.entries.filter(
    (entry) => entry.kind === "screen" && entry.id.startsWith("design-"),
  );
  let checked = 0;
  for (const entry of designs) {
    if (entry.kind !== "screen" || !entry.darkFragments) continue;
    for (const viewport of ["mobile", "desktop"] as const) {
      const route: string | undefined = entry.darkFragments[viewport];
      assert.ok(route, `${entry.id} ${viewport}`);
      const html = textOutput(outputs, route);
      assert.ok(html, route);
      for (const link of elements(
        parse(html),
        (node) => node.tagName === "a",
      )) {
        const id = attribute(link, "data-mokly-link");
        const target = designs.find((entry) => entry.id === id);
        if (target?.kind !== "screen") continue;
        const href = attribute(link, "href");
        assert.ok(href, `${route}: ${id} has no href`);
        checked += 1;
        assert.equal(
          path.posix.normalize(
            path.posix.join(path.posix.dirname(route), href),
          ),
          target.darkFragments?.[viewport] ?? target.fragments[viewport],
          `${route}: link to ${id} leaves the dark render`,
        );
      }
    }
  }
  assert.ok(checked > 0, "no dark fragment linked anywhere");
});

test("comparison families publish the same schemes for every member", async () => {
  const { manifest } = await designCatalogue;
  for (const family of COMPARISON_FAMILIES) {
    const members = family.map((id) => {
      const entry = manifest.entries.find((entry) => entry.id === id);
      assert.ok(entry?.kind === "screen", id);
      return [id, entry.darkFragments !== undefined] as const;
    });
    assert.deepEqual(
      members.filter(([, dual]) => !dual).map(([id]) => id),
      [],
      `light-only members would strand a dark comparison: ${family[0]}`,
    );
  }
});

test("a tag chip without a destination is a label, not a control", async () => {
  const { manifest, outputs } = await designCatalogue;
  const chipStyles = await fs.readFile(
    path.join(
      repositoryRoot,
      "examples/basic/generated/design-library/controls/tag-chip.css",
    ),
    "utf8",
  );
  // Cursor, hover and pressed styling belongs to a chip that navigates, so it
  // never promises an interaction a plain label cannot deliver.
  for (const [, selector, body] of chipStyles.matchAll(/([^{}]+)\{([^}]*)\}/gu))
    if (
      /cursor:|:hover|:active|box-shadow:|transform:/u.test(body ?? selector!)
    )
      assert.match(
        selector!,
        /\.mbk-chip\.tag:is\(a\)/u,
        `${selector!.trim()} styles a chip that may be a label`,
      );
  let labels = 0;
  for (const entry of manifest.entries) {
    if (entry.kind !== "screen" || !entry.route.startsWith("design/")) continue;
    for (const route of Object.values(entry.fragments)) {
      const html = textOutput(outputs, route);
      assert.ok(html, route);
      for (const chip of byClass(parse(html), "tag")) {
        if (!(attribute(chip, "class") ?? "").includes("mbk-chip")) continue;
        if (chip.tagName === "a") continue;
        labels += 1;
        assert.equal(chip.tagName, "span", `${route}: ${chip.tagName} chip`);
        assert.equal(attribute(chip, "data-mokly-link"), undefined, route);
      }
    }
  }
  assert.ok(labels > 0, "no destinationless tag chip was checked");
});
