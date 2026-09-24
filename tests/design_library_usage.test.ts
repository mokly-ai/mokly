import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { designCatalogue } from "./helpers/design_catalogue.js";
import { designLibrary } from "./helpers/design_library.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("every owning artboard records its shared chrome and real component consumers", async () => {
  const { manifest } = await designCatalogue;
  assert.equal(manifest.schemaVersion, 6);
  const screens = manifest.entries.flatMap((entry) =>
    entry.kind === "screen" && entry.route.startsWith("design/") ? [entry] : [],
  );
  assert.equal(screens.length, 79);
  for (const entry of screens) {
    assert.ok(entry.componentViews);
    for (const view of entry.componentViews) {
      const ids = new Set(
        view.instances.map((instance) => instance.componentId),
      );
      assert.ok(ids.has("design-ui-top-bar"), `${entry.id}/${view.viewport}`);
      if (view.viewport === "desktop")
        assert.ok(ids.has("design-ui-catalogue-navigation"), entry.id);
      if (
        !new Set([
          "design-browse-home",
          "design-browse-navigation",
          "design-browse-missing-route",
        ]).has(entry.id)
      )
        assert.ok(ids.has("design-ui-screen-header"), entry.id);
      if (entry.route.startsWith("design/components/"))
        for (const slug of [
          "screen-header",
          "view-controls",
          "inspector",
          "change-status",
        ])
          assert.ok(ids.has(`design-ui-${slug}`), `${entry.id}/${slug}`);
      assert.equal(
        new Set(view.instances.map((instance) => instance.key)).size,
        view.instances.length,
      );
      for (const instance of view.instances)
        assert.match(instance.id, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
    }
  }
  for (const [, slug] of designLibrary)
    for (const viewport of ["desktop", "mobile"])
      assert.ok(
        screens.some((entry) =>
          entry.componentViews?.some(
            (view) =>
              view.viewport === viewport &&
              view.instances.some(
                (instance) => instance.componentId === `design-ui-${slug}`,
              ),
          ),
        ),
        `${slug} has a real ${viewport} consumer`,
      );
});

test("nested chips and caller-owned frame slots retain their actual owner chains", async () => {
  const { manifest } = await designCatalogue;
  assert.equal(manifest.schemaVersion, 6);
  const picker = manifest.entries.find(
    (entry) => entry.id === "design-browse-tag-picker",
  );
  const flow = manifest.entries.find(
    (entry) => entry.id === "design-browse-use-case",
  );
  assert.ok(picker?.kind === "screen" && flow?.kind === "screen");
  assert.ok(picker.componentViews);
  for (const view of picker.componentViews) {
    const chip = view.instances.find(
      (instance) =>
        instance.componentId === "design-ui-tag-chip" &&
        instance.owner.kind === "instance",
    );
    assert.ok(chip?.owner.kind === "instance");
    const chipOwner = chip.owner.instanceKey;
    const parent = view.instances.find(
      (instance) => instance.key === chipOwner,
    );
    assert.equal(parent?.componentId, "design-ui-tag-picker");
    assert.ok(parent?.owner.kind === "instance");
    const pickerOwner = parent.owner.instanceKey;
    assert.equal(
      view.instances.find((instance) => instance.key === pickerOwner)
        ?.componentId,
      "design-ui-top-bar",
    );
  }
  assert.ok(flow.componentViews);
  for (const view of flow.componentViews) {
    const steps = view.instances.filter(
      (instance) => instance.componentId === "design-ui-flow-step",
    );
    assert.equal(steps.length, 2);
    assert.deepEqual(steps.map((instance) => instance.id).sort(), [
      "arrival",
      "detail",
    ]);
    const frames = view.instances.filter(
      (instance) => instance.componentId === "design-ui-device-frame",
    );
    assert.equal(frames.length, 2);
    assert.ok(
      frames.every(
        (instance) => instance.owner.kind === "entry" && instance.slotKey,
      ),
      "frames in caller slots remain screen-owned",
    );
  }
});

test("migrated composition cannot silently bypass the shared renderers", async () => {
  const root = path.join(repositoryRoot, "examples/basic/entries/design");
  const files = (await fs.readdir(root, { recursive: true })).filter(
    (file) => file.endsWith(".tsx") && !file.startsWith("library/"),
  );
  for (const file of files) {
    const source = await fs.readFile(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /from ["'][^"']*\.view\.js["']/, file);
    assert.doesNotMatch(
      source,
      /className=["'](?:mbk-topbar|mbk-screen-head|mbk-nav-head|ce-inspector-tabs|ce-control-field|flow-step|phone-frame|browser-frame)["']/,
      file,
    );
  }
});
