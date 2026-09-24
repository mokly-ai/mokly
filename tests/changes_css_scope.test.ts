import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { analysisOwnsStylesheet } from "../dist/review/css/paths.js";

import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

for (const components of [false, true])
  test(`v${components ? 5 : 4} excludes unrendered source token stylesheets from evidence`, async (t) => {
    const tokenPath = "src/styles/tokens.css";
    const fixture = await cssAttributionFixture(t, components, {
      prepare: async ({ root }) => {
        await fs.mkdir(path.join(root, "src/styles"), { recursive: true });
        await fs.writeFile(
          path.join(root, tokenPath),
          ":root { --tone: red; }",
        );
      },
    });
    await fs.writeFile(
      path.join(fixture.root, tokenPath),
      ":root { --tone: blue; }",
    );
    const { result } = await fixture.compare();
    assert.equal(analysisOwnsStylesheet(tokenPath, fixture.config), false);
    assert.equal(
      analysisOwnsStylesheet("mockups/shared.css", fixture.config),
      true,
    );
    assert.equal(
      analysisOwnsStylesheet("mockups/src/private.css", {
        ...fixture.config,
        entriesDir: path.join(fixture.mockupsDir, "src"),
      }),
      false,
    );
    assert.equal(result.schemaVersion, components ? 5 : 4);
    assert.equal(Object.hasOwn(result, "sharedImpact"), false);
    for (const screen of result.screens) {
      assert.equal(Object.hasOwn(screen, "sharedImpact"), false);
      assert.ok(
        screen.views.every((view) => !view.reasons && !view.excludedResources),
      );
    }
  });
