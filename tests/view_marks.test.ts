import assert from "node:assert/strict";
import test from "node:test";

import type { ShellCatalogueScreen } from "../packages/viewer/dist/catalogue/scoped_types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { publicWorkspace } from "../packages/viewer/dist/shell/public_workspace.js";
import {
  changedViewsLabel,
  type ChangedView,
} from "../packages/viewer/dist/shell/view_marks.js";

import { catalogueModel } from "./helpers/viewer_catalogue.js";

const DARK_ONLY: readonly ChangedView[] = [
  { viewport: "mobile", colorScheme: "dark" },
  { viewport: "desktop", colorScheme: "dark" },
];

test("changed views are ordered and named mobile first, light before dark", () => {
  const fixture = catalogueModel();
  const original = fixture.screens[1]!;
  const mobile = original.views[0]!;
  const desktop = original.views[1]!;
  const screen: ShellCatalogueScreen = {
    ...original,
    colorSchemes: ["light", "dark"],
    views: [
      mobile,
      { ...mobile, colorScheme: "dark" as const },
      {
        ...desktop,
        comparison: {
          status: "ready" as const,
          kind: "unmodified" as const,
          eligible: false,
        },
      },
      { ...desktop, colorScheme: "dark" as const },
    ],
  };
  const model = {
    ...fixture,
    screens: fixture.screens.map((entry) =>
      entry.path === screen.path ? screen : entry,
    ),
  };
  const data = publicWorkspace(createCatalogue(model), model, screen);
  assert.deepEqual(data.changedViews[screen.path], [
    { viewport: "mobile", colorScheme: "light" },
    { viewport: "mobile", colorScheme: "dark" },
    { viewport: "desktop", colorScheme: "dark" },
  ]);
  assert.equal(changedViewsLabel(DARK_ONLY), "Mobile · Dark, Desktop · Dark");
  assert.equal(changedViewsLabel([]), "");
});
