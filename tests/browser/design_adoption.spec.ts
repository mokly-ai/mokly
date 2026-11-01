import fs from "node:fs/promises";

import { expect } from "@playwright/test";

import type { CatalogueReadModel, EntryDetailV4 } from "@mokly/viewer";

import { test } from "./browser_test.js";
import { designLibrary } from "./design_library_inventory.js";

let index: CatalogueReadModel;
const details = new Map<string, EntryDetailV4>();
test.beforeAll(async ({ request, baseURL }) => {
  index = (await (
    await request.get(`${baseURL}/mokly-viewer/index.json`)
  ).json()) as CatalogueReadModel;
  for (const entry of index.screens.filter((entry) =>
    entry.path.startsWith("design/"),
  )) {
    const detail = (await (
      await request.get(`${baseURL}/mokly-viewer/entries/${entry.path}.json`)
    ).json()) as EntryDetailV4;
    details.set(entry.path, detail);
  }
});

test("the shared library preserves the frozen screen inventory and every saved sample", async () => {
  const baseline = JSON.parse(
    await fs.readFile(
      new URL("../fixtures/design-library/screens.json", import.meta.url),
      "utf8",
    ),
  ) as { path: string }[];
  expect(baseline).toHaveLength(54);
  for (const original of baseline) {
    const entry = index.screens.find((entry) => entry.path === original.path);
    expect(entry, original.path).toBeDefined();
    expect(
      entry!.views
        .filter((view) => view.colorScheme === "light")
        .map((view) => view.viewport)
        .sort(),
    ).toEqual(["desktop", "mobile"]);
  }
  const parents = index.components.filter(
    (entry) => entry.path.startsWith("design/library/") && !entry.variantOf,
  );
  expect(parents.map((entry) => entry.path).sort()).toEqual(
    designLibrary
      .map(([group, slug]) => `design/library/${group}/${slug}`)
      .sort(),
  );
  for (const [group, slug, variants] of designLibrary) {
    const path = `design/library/${group}/${slug}`;
    expect(
      index.components
        .filter((entry) => entry.variantOf === path)
        .map((entry) => entry.path)
        .sort(),
    ).toEqual(variants.map((variant) => `${path}/${variant}`).sort());
    expect(
      Object.keys(parents.find((entry) => entry.path === path)!.controls)
        .length,
    ).toBeGreaterThan(0);
  }
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: every design records its shared chrome and real component consumers`, () => {
    const consumed = new Set<string>();
    const startup = new Set(
      ["catalogue-loading", "catalogue-failed", "viewer-version"].map(
        (name) => `design/browse/loading/${name}`,
      ),
    );
    expect(details.size).toBe(
      index.screens.filter((entry) => entry.path.startsWith("design/")).length,
    );
    expect(details.size).toBeGreaterThan(0);
    for (const [path, detail] of details) {
      const views = detail.views.filter((view) => view.viewport === viewport);
      expect(views.length, path).toBeGreaterThan(0);
      for (const view of views) {
        if (view.usage.status !== "ready")
          throw new Error(`Usage unavailable: ${path}/${viewport}`);
        const ids = new Set(
          view.usage.instances.map((instance) => instance.componentId),
        );
        for (const id of ids) consumed.add(id);
        expect(
          ids.has(
            `design/library/${startup.has(path) ? "preview/empty-state" : "chrome/top-bar"}`,
          ),
          path,
        ).toBe(true);
        if (viewport === "desktop" && !startup.has(path))
          expect(
            ids.has("design/library/chrome/catalogue-navigation"),
            path,
          ).toBe(true);
        expect(
          new Set(view.usage.instances.map((instance) => instance.key)).size,
        ).toBe(view.usage.instances.length);
      }
    }
    for (const [group, slug] of designLibrary)
      expect(
        consumed.has(`design/library/${group}/${slug}`),
        `${group}/${slug}`,
      ).toBe(true);
  });

  test(`${viewport}: nested chips and frame slots keep their actual owner chains`, () => {
    const picker = details
      .get("design/browse/views/screen/tag-picker")!
      .views.find((view) => view.viewport === viewport)!;
    if (picker.usage.status !== "ready")
      throw new Error("Picker usage unavailable");
    const instances = picker.usage.instances;
    const chip = instances.find(
      (instance) =>
        instance.componentId === "design/library/controls/tag-chip" &&
        instance.owner.kind === "instance",
    )!;
    if (chip.owner.kind !== "instance") throw new Error("Chip has no parent");
    const pickerKey = chip.owner.instanceKey;
    const parent = instances.find((instance) => instance.key === pickerKey)!;
    expect(parent.componentId).toBe("design/library/controls/tag-picker");
    if (parent.owner.kind !== "instance")
      throw new Error("Picker has no parent");
    const topKey = parent.owner.instanceKey;
    expect(
      instances.find((instance) => instance.key === topKey)!.componentId,
    ).toBe("design/library/chrome/top-bar");
    const flow = details
      .get("design/browse/views/use-case")!
      .views.find((view) => view.viewport === viewport)!;
    if (flow.usage.status !== "ready")
      throw new Error("Flow usage unavailable");
    const steps = flow.usage.instances.filter(
      (instance) => instance.componentId === "design/library/preview/flow-step",
    );
    expect(steps.map((instance) => instance.id).sort()).toEqual([
      "arrival",
      "detail",
    ]);
    const frames = flow.usage.instances.filter(
      (instance) =>
        instance.componentId === "design/library/preview/device-frame",
    );
    expect(frames).toHaveLength(2);
    expect(
      frames.every(
        (instance) => instance.owner.kind === "entry" && instance.slotKey,
      ),
    ).toBe(true);
  });
}
