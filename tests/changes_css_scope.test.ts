import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { analysisOwnsStylesheet } from "../packages/mokly/dist/review/css/paths.js";

import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

for (const components of [false, true])
  test(`v${components ? 3 : 2} keeps source token stylesheets in shared impact`, async (t) => {
    const tokenPath = "src/styles/tokens.css";
    const fixture = await cssAttributionFixture(t, components, {
      prepare: async ({ root, configPath }) => {
        await fs.mkdir(path.join(root, "src/styles"), { recursive: true });
        await fs.writeFile(
          path.join(root, tokenPath),
          ":root { --tone: red; }",
        );
        await fs.writeFile(
          configPath,
          (await fs.readFile(configPath, "utf8")).replace(
            'sharedImpact: ["mockups/**"]',
            'sharedImpact: ["src/styles/**"]',
          ),
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
        sourceFiles: [
          ...(fixture.config.sourceFiles ?? []),
          "mockups/src/private.css",
        ],
      }),
      false,
    );
    assert.equal(result.schemaVersion, 5);
    assert.deepEqual(result.sharedImpact, [tokenPath]);
    for (const screen of result.screens) {
      assert.deepEqual(screen.sharedImpact, [tokenPath]);
      assert.ok(
        screen.views.every((view) => !view.reasons && !view.excludedResources),
      );
    }
  });
