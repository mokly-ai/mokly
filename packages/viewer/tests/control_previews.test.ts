import assert from "node:assert/strict";
import { test } from "node:test";

import type { ComponentRenderSuccess } from "../src/components/render_types.js";
import type { GeneratedComponentView } from "../src/components/views.js";
import {
  controlViewKey,
  withPreviews,
} from "../src/shell/component_controls_state.js";
import type { ControlTarget } from "../src/shell/control_values.js";

const view = (
  variantPath: string | undefined,
  viewport: "mobile" | "desktop",
): GeneratedComponentView => ({
  path: `saved/${variantPath ?? "screen"}/${viewport}.html`,
  viewport,
  colorScheme: "light",
  ...(variantPath === undefined ? {} : { variantPath }),
});

const preview: ComponentRenderSuccess = {
  renderId: "r-1",
  revision: 2,
  previewUrl: "/mokly-viewer/components/renders/r-1/index%20page.html",
  props: {},
  usage: { status: "ready", instances: [], slots: [], ranges: [] },
};

function target(path: string, kind: ControlTarget["kind"]): ControlTarget {
  return {
    path,
    kind,
    propSchema: { type: "object", additionalProperties: false },
    props: {},
    controls: {},
    suppliedSlots: [],
    removed: false,
  };
}

test("only the edited entry's views show the temporary preview", () => {
  const views = [
    view("components/action", "mobile"),
    view("components/action/default", "mobile"),
  ];
  const previews = new Map([[controlViewKey(views[0]!), preview]]);
  const shown = withPreviews(
    views,
    previews,
    target("components/action", "component"),
  );
  assert.equal(
    shown[0]!.path,
    "/mokly-viewer/components/renders/r-1/index page.html",
  );
  assert.deepEqual(shown[0]!.usage?.ranges, []);
  assert.equal(shown[1], views[1]);
});

test("a screen swaps its own views and keeps saved views without a preview", () => {
  const views = [view(undefined, "mobile"), view(undefined, "desktop")];
  const previews = new Map([[controlViewKey(views[1]!), preview]]);
  const shown = withPreviews(views, previews, target("home", "screen"));
  assert.equal(shown[0], views[0]);
  assert.match(shown[1]!.path, /renders\/r-1\//);
  assert.deepEqual(withPreviews(views, previews, undefined), views);
});
