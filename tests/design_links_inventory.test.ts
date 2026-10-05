import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { parse } from "parse5";

import { actionModes } from "../examples/basic/specs/design/components/parts/navigation_states.js";
import {
  appearanceModes,
  welcomeModes,
} from "../examples/basic/specs/design/parts/navigation_states.js";
import { generatedViews, viewRoute } from "../packages/viewer/dist/data.js";

import {
  attribute,
  byClass,
  designCatalogue,
  elements,
} from "./helpers/design_catalogue.js";
import { repositoryRoot } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

test("the canonical documented inventory exactly matches the complete design paths", async () => {
  const { manifest } = await designCatalogue;
  const spec = (
    await Promise.all(
      [
        "docs/protocol/mokly-shell-design-inventory.md",
        "docs/protocol/mokly-component-design.md",
        "docs/protocol/mokly-component-inspector-design.md",
        "docs/protocol/mokly-component-controls-design.md",
      ].map((file) => fs.readFile(path.join(repositoryRoot, file), "utf8")),
    )
  ).join("\n");
  const documented = [...spec.matchAll(/\|\s*`(design\/[^`]+)`\s*\|/g)]
    .map((match) => match[1])
    .sort();
  const actual = manifest.entries
    .flatMap((entry) =>
      entry.kind === "screen" && entry.path.startsWith("design/")
        ? [entry.path]
        : [],
    )
    .sort();
  assert.deepEqual(documented, actual);
});

const COMPARISON_FAMILIES = [
  Object.values(welcomeModes),
  Object.values(appearanceModes),
  Object.values(actionModes),
];

test("a dark fragment's links stay dark wherever the target has a dark render", async () => {
  const { manifest, outputs } = await designCatalogue;
  const designs = manifest.entries.filter(
    (entry) => entry.kind === "screen" && entry.path.startsWith("design/"),
  );
  let checked = 0;
  for (const entry of designs) {
    if (entry.kind !== "screen" || !entry.colorSchemes.includes("dark"))
      continue;
    for (const viewport of ["mobile", "desktop"] as const) {
      const route = viewRoute(entry.path, viewport, "dark");
      assert.ok(route, `${entry.path} ${viewport}`);
      const html = textOutput(outputs, route);
      assert.ok(html, route);
      for (const link of elements(
        parse(html),
        (node) => node.tagName === "a",
      )) {
        const id = attribute(link, "data-mokly-link");
        const target = designs.find((entry) => entry.path === id);
        if (target?.kind !== "screen") continue;
        const href = attribute(link, "href");
        assert.ok(href, `${route}: ${id} has no href`);
        checked += 1;
        assert.equal(
          path.posix.normalize(
            path.posix.join(path.posix.dirname(route), href),
          ),
          viewRoute(
            target.path,
            viewport,
            target.colorSchemes.includes("dark") ? "dark" : "light",
          ),
          `${route}: link to ${id} leaves the dark render`,
        );
      }
    }
  }
  assert.ok(checked > 0, "no dark fragment linked anywhere");
});

test("comparison families publish the same schemes for every member", async () => {
  const { manifest } = await designCatalogue;
  const dualFamilies: boolean[] = [];
  for (const family of COMPARISON_FAMILIES) {
    const members = family.map((id) => {
      const entry = manifest.entries.find((entry) => entry.path === id);
      assert.ok(entry?.kind === "screen", id);
      return [id, entry.colorSchemes.includes("dark")] as const;
    });
    const dual = members[0]![1];
    dualFamilies.push(dual);
    assert.deepEqual(
      members.filter(([, member]) => member !== dual).map(([id]) => id),
      [],
      `a member with other schemes would strand a comparison: ${family[0]}`,
    );
  }
  assert.deepEqual(dualFamilies, [true, true, false]);
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
    if (entry.kind !== "screen" || !entry.path.startsWith("design/")) continue;
    for (const route of generatedViews(entry)
      .filter((view) => view.colorScheme === "light")
      .map((view) => view.path)) {
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
