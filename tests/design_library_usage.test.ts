import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { designCatalogue, designEntries } from "./helpers/design_catalogue.js";
import { designLibrary } from "./helpers/design_library.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("every owning artboard records its shared chrome and real component consumers", async () => {
  const { manifest } = await designCatalogue;
  assert.ok(manifest.schemaVersion === 8);
  const screens = (
    await designEntries(
      (entry) => entry.kind === "screen" && entry.path.startsWith("design/"),
      "shared chrome consumers",
    )
  ).flatMap((entry) => (entry.kind === "screen" ? [entry] : []));
  assert.equal(screens.length, 111);
  for (const entry of screens) {
    assert.ok(entry.componentViews);
    for (const view of entry.componentViews) {
      const ids = new Set(
        view.instances.map((instance) => instance.componentId),
      );
      assert.ok(
        ids.has("design/library/chrome/top-bar"),
        `${entry.path}/${view.viewport}`,
      );
      if (view.viewport === "desktop")
        assert.ok(
          ids.has("design/library/chrome/catalogue-navigation"),
          entry.path,
        );
      if (
        !new Set([
          "design/browse/views/home",
          "design/browse/states/navigation",
          "design/browse/states/missing-route",
          "design/browse/appearance/status/home",
          "design/browse/appearance/workspaces/drawer",
        ]).has(entry.path)
      )
        assert.ok(ids.has("design/library/chrome/screen-header"), entry.path);
      if (entry.path.startsWith("design/components/"))
        for (const relative of [
          "chrome/screen-header",
          "controls/view-controls",
          "inspector/inspector",
          "controls/change-status",
        ])
          assert.ok(
            ids.has(`design/library/${relative}`),
            `${entry.path}/${relative}`,
          );
      assert.equal(
        new Set(view.instances.map((instance) => instance.key)).size,
        view.instances.length,
      );
      for (const instance of view.instances)
        assert.match(instance.id, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
    }
  }
  for (const [group, slug] of designLibrary)
    for (const viewport of ["desktop", "mobile"])
      assert.ok(
        screens.some((entry) =>
          entry.componentViews?.some(
            (view) =>
              view.viewport === viewport &&
              view.instances.some(
                (instance) =>
                  instance.componentId === `design/library/${group}/${slug}`,
              ),
          ),
        ),
        `${slug} has a real ${viewport} consumer`,
      );
});

test("nested chips and caller-owned frame slots retain their actual owner chains", async () => {
  const { manifest } = await designCatalogue;
  assert.ok(manifest.schemaVersion === 8);
  const picker = manifest.entries.find(
    (entry) => entry.path === "design/browse/views/screen/tag-picker",
  );
  const flow = manifest.entries.find(
    (entry) => entry.path === "design/browse/views/use-case",
  );
  assert.ok(picker?.kind === "screen" && flow?.kind === "screen");
  assert.ok(picker.componentViews);
  for (const view of picker.componentViews) {
    const chip = view.instances.find(
      (instance) =>
        instance.componentId === "design/library/controls/tag-chip" &&
        instance.owner.kind === "instance",
    );
    assert.ok(chip?.owner.kind === "instance");
    const chipOwner = chip.owner.instanceKey;
    const parent = view.instances.find(
      (instance) => instance.key === chipOwner,
    );
    assert.equal(parent?.componentId, "design/library/controls/tag-picker");
    assert.ok(parent?.owner.kind === "instance");
    const pickerOwner = parent.owner.instanceKey;
    assert.equal(
      view.instances.find((instance) => instance.key === pickerOwner)
        ?.componentId,
      "design/library/chrome/top-bar",
    );
  }
  assert.ok(flow.componentViews);
  for (const view of flow.componentViews) {
    const steps = view.instances.filter(
      (instance) => instance.componentId === "design/library/preview/flow-step",
    );
    assert.equal(steps.length, 2);
    assert.deepEqual(steps.map((instance) => instance.id).sort(), [
      "arrival",
      "detail",
    ]);
    const frames = view.instances.filter(
      (instance) =>
        instance.componentId === "design/library/preview/device-frame",
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
  const root = path.join(repositoryRoot, "examples/basic/specs/design");
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
