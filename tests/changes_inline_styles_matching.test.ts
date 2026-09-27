import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { compareReview } from "../dist/review/compare.js";
import { committedReviewRepository } from "../dist/review/repository.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { inlineComponentSource } from "./helpers/inline_changes.js";

function renderer(color: string): string {
  return `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => {
  const body = renderToStaticMarkup(input.node);
  return '<html><head><link rel="stylesheet" href="' + input.stylesheets[0] + '"></head><body><style>.unused{color:${color}}</style>' + body + '</body></html>';
};`;
}

test("linked stylesheet matching uses real documents before inline material removal", async (t) => {
  const fixture = await changedFixture(
    t,
    inlineComponentSource(),
    {
      extraConfig:
        'renderer: "renderer.tsx", stylesheets: [{ match: "**", stylesheets: ["shared.css"] }],',
    },
    async ({ root, mockupsDir }) => {
      await fs.writeFile(path.join(root, "renderer.tsx"), renderer("red"));
      await fs.writeFile(
        path.join(mockupsDir, "shared.css"),
        "style + main{padding:1px}",
      );
    },
  );
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), renderer("blue"));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "shared.css"),
    "style + main{padding:2px}",
  );
  await fixture.build();
  const repository = committedReviewRepository(fixture.config);
  const { result } = await compareReview(
    await compileCatalogue(fixture.config),
    fixture.config,
    repository,
    "main",
  );
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  const home = result.screens.find((screen) => screen.id === "home")!;
  assert.ok(home.views.every((view) => view.state === "changed"));
  assert.ok(
    home.views.every((view) =>
      view.reasons?.some(
        (reason) =>
          reason.path === "mockups/shared.css" &&
          reason.analysis?.status === "matched",
      ),
    ),
  );
});
