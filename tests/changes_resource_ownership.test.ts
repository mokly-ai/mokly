import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { compareReview } from "../dist/review/compare.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../dist/review/git.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { componentEntrySource } from "./helpers/component_fixture.js";

test("a non-CSS resource owned only at an actual invocation changes its component", async (t) => {
  const fixture = await changedFixture(
    t,
    componentEntrySource({
      actionRender:
        '(props) => <button>{props.label === "Finish" ? <img src="../image.svg" /> : props.label}</button>',
    }),
    { extraConfig: 'renderer: "renderer.tsx",' },
    async ({ root, mockupsDir }) => {
      await fs.writeFile(path.join(mockupsDir, "image.svg"), "original");
      await fs.writeFile(
        path.join(root, "renderer.tsx"),
        `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => {
  const html = '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';
  return { html, resources: html.includes('image.svg') ? [{ path: "image.svg", componentIds: ["action"] }] : [] };
};`,
      );
    },
  );
  await fs.writeFile(path.join(fixture.mockupsDir, "image.svg"), "updated");
  const git = new CommittedRepository(new NodeGitCommandRunner(fixture.root));
  const { result } = await compareReview(
    await compileCatalogue(fixture.config),
    fixture.config,
    git,
    "main",
  );
  assert.equal(result.schemaVersion, 5);
  if (result.schemaVersion !== 5) return;
  assert.deepEqual(
    result.changes.map((change) => (change.after ?? change.before)!.id),
    ["action"],
  );
  assert.ok(
    result.affectedConsumers.some(
      (affected) => affected.consumer.kind === "screen",
    ),
  );
  assert.deepEqual(
    (
      await computeCatalogueChanges(
        fixture.config,
        "main",
        committedReviewRepository(fixture.config),
      )
    ).changedRoutes,
    ["components/action.html"],
  );
});
