/**
 * Details follow the designs' order (component workspace design contract):
 * the branch point and a moved entry's earlier side, then one sentence per
 * reason, the stylesheets, the paired prop values, and the changed
 * components used here.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";
import { viewerCatalogue } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import { shellModelFixture } from "./catalogue_v9_fixture.js";

/** The moved fixture screen, whose detail examined and excluded a stylesheet. */
const MOVED = "product/browse/details";

test("Details read reasons before the other evidence", () => {
  const model = shellModelFixture();
  const catalogue = viewerCatalogue(model);
  const entry = catalogue.byPath.get(MOVED);
  assert.ok(entry?.kind === "screen");
  const data = publicWorkspace(
    catalogue,
    model,
    entry,
    true,
    undefined,
    "main",
  );
  const markup = renderToStaticMarkup(
    <WorkspaceEvidence
      data={{
        ...data,
        status: "Changed",
        reasons: [{ kind: "inputs" }, { kind: "material" }],
        relatedComponents: [{ path: "components/action", title: "Action" }],
        inputChanges: [
          {
            instanceId: "footer",
            title: "Action",
            viewport: "desktop",
            colorScheme: "light",
            before: { label: ["string", "Continue"] },
            after: { label: ["string", "Get started"] },
          },
        ],
      }}
      previousPath="product/details"
    />,
  );
  const order = [
    "<p>Compared with the branch point on main.</p>",
    "<p>The previous version is at ",
    "<p>Supplied props or slots changed.</p>",
    "<p>Rendered content changed.</p>",
    "<p>This stylesheet changed, but none of the changed styles apply to this screen.</p>",
    "<h3>Action · footer · desktop · light</h3>",
    "<p>Changed component: <a ",
  ];
  const positions = order.map((fragment) => markup.indexOf(fragment));
  assert.ok(
    positions.every((position) => position >= 0),
    markup,
  );
  assert.deepEqual(
    positions,
    [...positions].sort((left, right) => left - right),
    markup,
  );
});
