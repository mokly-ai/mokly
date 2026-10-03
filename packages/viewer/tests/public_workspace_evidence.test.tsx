import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import {
  catalogue,
  model,
  source,
  sourceVariant,
} from "./component_workspace_fixture.js";

const EXCLUDED = {
  path: "mockups/action.css",
  reason: "no-matching-rule",
} as const;

test("a published screen keeps its catalogue view evidence in Current", () => {
  const entry = catalogue.byId.get("home");
  assert.ok(entry?.kind === "screen");
  const data = publicWorkspace(model, entry);
  assert.deepEqual(data.resourceEvidence, [
    { viewport: "mobile", colorScheme: "light", excludedResources: [EXCLUDED] },
  ]);
  const markup = renderToStaticMarkup(<WorkspaceEvidence data={data} />);
  assert.match(
    markup,
    /<p>This stylesheet changed, but none of the changed styles apply to this screen\.<\/p><p>Examined and excluded:<\/p><ul><li>mockups\/action\.css<\/li><\/ul>/,
  );
  assert.match(markup, /<p>No changes to this screen\.<\/p><\/section>$/);
});

test("a published component keeps its selected saved view's evidence", () => {
  for (const entry of [source, sourceVariant]) {
    const data = publicWorkspace(model, entry);
    assert.deepEqual(
      data.resourceEvidence,
      (["mobile", "desktop"] as const).map((viewport) => ({
        viewport,
        colorScheme: "light",
        excludedResources: [EXCLUDED],
      })),
    );
    const markup = renderToStaticMarkup(
      <WorkspaceEvidence data={data} variantId={sourceVariant.id} />,
    );
    assert.match(
      markup,
      /<p>This stylesheet changed, but none of the changed styles apply to this variant\.<\/p>/,
    );
    assert.match(markup, /<p>No changes to this saved view\.<\/p><\/section>$/);
  }
});

test("a published screen without view evidence projects none", () => {
  const entry = catalogue.byId.get("home-empty");
  assert.ok(entry?.kind === "screen");
  assert.equal(publicWorkspace(model, entry).resourceEvidence, undefined);
});
