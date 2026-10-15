import assert from "node:assert/strict";
import { test } from "node:test";

import type { ComponentRenderSuccess } from "../src/components/render_types.js";
import type { GeneratedComponentView } from "../src/components/views.js";
import {
  controlViewKey,
  withPreviews,
} from "../src/shell/component_controls_state.js";
import type { ControlTarget } from "../src/shell/control_values.js";
import { generatedUsage } from "../src/shell/stage_sources.js";

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

test("one render keeps one previewed view, so frames see no new usage", () => {
  const views = [view(undefined, "mobile"), view(undefined, "desktop")];
  const key = controlViewKey(views[0]!);
  const first = withPreviews(
    views,
    new Map([[key, preview]]),
    target("home", "screen"),
  );
  // A later workspace render passes a new map and a new target object.
  const again = withPreviews(
    views,
    new Map([[key, preview]]),
    target("home", "screen"),
  );
  assert.equal(again[0], first[0]);
  assert.equal(generatedUsage(again[0]!), generatedUsage(first[0]!));
  const next: ComponentRenderSuccess = {
    ...preview,
    renderId: "r-2",
    previewUrl: "/mokly-viewer/components/renders/r-2/index.html",
  };
  const replaced = withPreviews(
    views,
    new Map([[key, next]]),
    target("home", "screen"),
  );
  assert.notEqual(replaced[0], first[0]);
  assert.match(replaced[0]!.path, /renders\/r-2\//);
});

test("the projection keeps one array per render result, so sessions stay put", () => {
  const views = [view(undefined, "mobile"), view(undefined, "desktop")];
  // Without previews, every render gets the saved array itself.
  assert.equal(withPreviews(views, new Map(), target("home", "screen")), views);
  // With previews, a later render with a new target object gets the same array.
  const previews = new Map([[controlViewKey(views[0]!), preview]]);
  const first = withPreviews(views, previews, target("home", "screen"));
  assert.notEqual(first, views);
  assert.equal(withPreviews(views, previews, target("home", "screen")), first);
  assert.notEqual(
    withPreviews(views, previews, target("other", "screen")),
    first,
  );
});

test("a screen swaps its own views and keeps saved views without a preview", () => {
  const views = [view(undefined, "mobile"), view(undefined, "desktop")];
  const previews = new Map([[controlViewKey(views[1]!), preview]]);
  const shown = withPreviews(views, previews, target("home", "screen"));
  assert.equal(shown[0], views[0]);
  assert.match(shown[1]!.path, /renders\/r-1\//);
  assert.deepEqual(withPreviews(views, previews, undefined), views);
});
