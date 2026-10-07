import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";

import {
  assertFastPathEquivalent,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  inlineChangesFixture,
  inlineComponentSource,
} from "./helpers/inline_changes.js";

test("excluded inline evidence is omitted from an ignored-only view", async (t) => {
  const source = inlineComponentSource().replaceAll(
    "Screen content",
    '<ReviewIgnore id="clock">Before</ReviewIgnore>',
  );
  const fixture = await inlineChangesFixture(
    t,
    "<style>.unused{color:red}</style>",
    "<style>.unused{color:blue}</style>",
    { source, afterSource: source.replaceAll(">Before<", ">After<") },
  );
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  const home = result.screens.find((screen) => screen.path === "home")!;
  assert.ok(
    home.views.every(
      (view) => view.state === "ignored-only" && !view.inlineStyles,
    ),
  );
});

test("excluded inline evidence is omitted beside a resource reason", async (t) => {
  const source = inlineComponentSource().replaceAll(
    '<main className="entry">',
    '<main className="entry"><img src="../../image.svg" />',
  );
  const fixture = await inlineChangesFixture(
    t,
    "<style>.unused{color:red}</style>",
    "<style>.unused{color:blue}</style>",
    {
      source,
      files: {
        before: { "image.svg": "before-image" },
        after: { "image.svg": "after-image" },
      },
    },
  );
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  assert.ok(
    result.screens
      .find((screen) => screen.path === "home")!
      .views.every(
        (view) =>
          view.state === "changed" &&
          Boolean(view.reasons?.length) &&
          !view.inlineStyles,
      ),
  );
});

test("excluded inline evidence is omitted beside an input reason", async (t) => {
  const source = componentEntrySource();
  const fixture = await inlineChangesFixture(
    t,
    "<style>.unused{color:red}</style>",
    "<style>.unused{color:blue}</style>",
    {
      source,
      afterSource: source.replaceAll(
        'label="Hidden" hidden',
        'label="Invisible edit" hidden',
      ),
    },
  );
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  const home = result.changes.find((entry) => entry.after?.path === "home");
  assert.deepEqual(home?.reasons, [{ kind: "inputs" }]);
  assert.ok(
    result.screens
      .find((screen) => screen.path === "home")!
      .views.every((view) => view.state === "unchanged" && !view.inlineStyles),
  );
});

test("excluded evidence is omitted for a derived byte-only material change", async (t) => {
  const source = inlineComponentSource().replaceAll(
    '<main className="entry">',
    '<main className="entry"><img src="../../image.svg" />',
  );
  const fixture = await createFixture(source, {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    scopedRenderer("<style>.unused{color:red}</style>"),
  );
  await fs.writeFile(path.join(fixture.mockupsDir, "image.svg"), "image");
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    scopedRenderer("<style>.unused{color:blue}</style>"),
  );
  const after = await compileCatalogue(config);
  const result = await assertFastPathEquivalent({
    before: before.manifest,
    after: after.manifest,
    beforeFiles: compilationFiles(before, { "image.svg": "before-image" }),
    afterFiles: compilationFiles(after, { "image.svg": "after-image" }),
    changedPaths: [],
    config: config,
  });
  const home = result.screens.find((screen) => screen.path === "home")!;
  assert.ok(
    home.views.every(
      (view) => view.state === "changed" && !view.reasons && !view.inlineStyles,
    ),
  );
  assert.deepEqual(
    result.changes.find((entry) => entry.after?.path === "home")?.reasons,
    [{ kind: "material" }],
  );
});

function scopedRenderer(styles: string): string {
  return `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<!doctype html><html><head>' + (input.entry.path === "home" ? ${JSON.stringify(styles)} : '<style>.stable{color:black}</style>') + '</head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`;
}

test("views settled by the fast path emit no inline evidence", async (t) => {
  const styles = "<style>.action{color:red}</style>";
  const fixture = await inlineChangesFixture(t, styles, styles);
  const events: TimingEvent[] = [];
  const { result } = await runWithTimings(
    true,
    "test",
    () => fixture.complete(true),
    { write: (event) => events.push(event) },
  );
  const counts = events.find(
    (event) =>
      event.stage === "review.compare-screens" && event.event === "counts",
  )?.counts;
  assert.ok(Number(counts?.fastPath) > 0);
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  assert.ok(
    [
      ...result.screens.flatMap((screen) => screen.views),
      ...result.components.flatMap((component) =>
        component.variants.flatMap((variant) => variant.views),
      ),
    ].every((view) => !view.inlineStyles),
  );
});
