import assert from "node:assert/strict";
import test from "node:test";

import { publishedViewStatesBySelection } from "../src/viewer/public_workspace_views.js";

import { componentWorkspaceFixture } from "./component_workspace_fixture.js";

test("unready view evidence cannot inherit a value from a prototype-shaped path", () => {
  const { model } = componentWorkspaceFixture();
  const screen = model.screens[0]!;
  const states = publishedViewStatesBySelection({
    ...screen,
    path: "__proto__",
    views: screen.views.map((view) => ({
      ...view,
      comparison: { status: "pending" },
    })),
  });
  assert.equal(states["__proto__"], undefined);
  assert.equal(states["constructor"], undefined);
});
