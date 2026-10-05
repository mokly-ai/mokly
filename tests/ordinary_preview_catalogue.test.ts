import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parseManifest } from "../dist/registry/manifest.js";

import { createCommittedExampleBaseline } from "./helpers/example_baseline.js";
import { repositoryRoot } from "./helpers/fixture.js";
import { FULL_CATALOGUE_SETUP_TIMEOUT_MS } from "./helpers/fixture_timing.js";

test(
  "ordinary preview renders only opened entries and keeps other destinations as navigation stand-ins",
  { timeout: FULL_CATALOGUE_SETUP_TIMEOUT_MS },
  async (context) => {
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/m8-ordinary-"),
    );
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    const config = await createCommittedExampleBaseline(
      root,
      "ordinary-preview",
    );
    const manifest = parseManifest(
      JSON.parse(
        await fs.readFile(
          path.join(config.mockupsDir, "mokly-manifest.json"),
          "utf8",
        ),
      ),
    );
    const screens = manifest.entries
      .filter(
        (entry) =>
          entry.kind === "screen" &&
          entry.description !== "Navigation-only fixture destination",
      )
      .map((entry) => entry.path)
      .sort();
    assert.deepEqual(
      screens,
      [
        "example/screens/welcome",
        "example/screens/details",
        "design/browse/views/home",
        "design/browse/views/screen",
        "design/browse/views/details-screen",
        "design/browse/views/screen/tag-picker",
        "design/browse/views/screen/tag-onboarding",
        "design/browse/views/screen/tag-onboarding-picker",
        "design/browse/pages/view",
        "design/browse/pages/details",
      ].sort(),
    );
    assert.deepEqual(
      manifest.entries
        .filter((entry) => entry.kind === "use-case")
        .map((entry) => entry.path),
      ["example/tour"],
    );
    const links = new Set<string>();
    for (const filename of await fs.readdir(config.mockupsDir, {
      recursive: true,
    })) {
      if (!filename.endsWith(".html")) continue;
      const html = await fs.readFile(
        path.join(config.mockupsDir, filename),
        "utf8",
      );
      for (const match of html.matchAll(/data-mokly-link="([^"]+)"/gu))
        links.add(match[1]!);
    }
    for (const entry of manifest.entries.filter(
      (entry) =>
        entry.kind === "page" &&
        entry.description === "Navigation-only fixture destination",
    ))
      assert.ok(
        links.has(entry.path),
        `stand-in ${entry.path} must be a rendered destination`,
      );
    const used = new Set(
      manifest.entries.flatMap((entry) =>
        entry.kind !== "component" && "componentViews" in entry
          ? entry.componentViews.flatMap((view) =>
              view.instances.map((instance) => instance.componentId),
            )
          : [],
      ),
    );
    for (const component of manifest.entries.filter(
      (entry) => entry.kind === "component" && !("variantOf" in entry),
    )) {
      assert.ok(
        used.has(component.path),
        `${component.path} must render in an opened entry`,
      );
      const variants = manifest.entries.filter(
        (entry) => "variantOf" in entry && entry.variantOf === component.path,
      );
      assert.equal(variants.length, 1, component.path);
      for (const variant of variants) {
        assert.ok("componentViews" in variant);
        assert.ok(
          variant.componentViews.every((view) => view.instances.length === 0),
          variant.path,
        );
      }
    }
    assert.ok(
      manifest.entries.some(
        (entry) =>
          entry.path === "design/browse/states/navigation" &&
          entry.kind === "page",
      ),
    );
  },
);
