import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import type { ComponentInstanceRecord } from "../packages/viewer/src/generated/catalogue/ComponentInstanceRecord.js";

import {
  bypassViolations,
  inventoryViolations,
  libraryViolations,
  reachabilityViolations,
  scopeViolations,
} from "./helpers/design_catalogue_checks.js";
import {
  expectationViolations,
  tagViolations,
} from "./helpers/design_link_checks.js";
import {
  adoptionViolations,
  componentSheetViolations,
  keyboardStopViolations,
  linkViolations,
  scriptViolations,
} from "./helpers/design_rules.js";
import { serveExample, type ServedCatalogue } from "./helpers/served_design.js";

// The design catalogue checks of the design component, component library,
// component design, and design links contracts, over one served example.

test("composition outside the library uses the registered components", () => {
  assert.deepEqual(bypassViolations(), []);
});

describe("the served design catalogue", () => {
  let catalogue: ServedCatalogue;
  let close: () => Promise<void>;
  before(
    async () => {
      // An expected-state allowance: Serve renders every view of the example.
      ({ catalogue, close } = await serveExample(AbortSignal.timeout(300_000)));
    },
    { timeout: 600_000 },
  );
  after(() => close?.());

  test("design screens match the frozen inventory in both viewports", () => {
    assert.deepEqual(inventoryViolations(catalogue), []);
  });

  test("shared components keep their pages, saved variants, and consumers", () => {
    assert.deepEqual(libraryViolations(catalogue), []);
  });

  test("each design view records the shared components of its family", () => {
    assert.deepEqual(adoptionViolations(catalogue), []);
  });

  test("nested and caller-owned instances keep their owner chains", () => {
    const usage = (path: string) =>
      catalogue.details.get(path)!.views.map(({ usage }) => {
        assert.ok(usage.status === "ready", path);
        return usage.instances;
      });
    const of = (id: string, instances: readonly ComponentInstanceRecord[]) =>
      instances.filter(
        (instance) => instance.componentId === `design/library/${id}`,
      );
    for (const instances of usage("design/browse/views/screen/tag-picker")) {
      const byKey = new Map(
        instances.map((instance) => [instance.key, instance]),
      );
      const owner = (instance?: ComponentInstanceRecord) =>
        instance?.owner.kind === "instance"
          ? byKey.get(instance.owner.instanceKey)
          : undefined;
      const chip = of("controls/tag-chip", instances).find(
        (instance) => instance.owner.kind === "instance",
      );
      const picker = owner(chip);
      assert.equal(picker?.componentId, "design/library/controls/tag-picker");
      assert.equal(owner(picker)?.componentId, "design/library/chrome/top-bar");
    }
    for (const instances of usage("design/browse/views/use-case")) {
      const steps = of("preview/flow-step", instances);
      assert.deepEqual(steps.map((step) => step.id).sort(), [
        "arrival",
        "detail",
      ]);
      const frames = of("preview/device-frame", instances);
      assert.equal(frames.length, 2);
      assert.equal(new Set(frames.map((frame) => frame.key)).size, 2);
      for (const frame of frames) {
        assert.equal(frame.owner.kind, "entry");
        assert.ok(frame.slotKey, "a framed step stays in the caller's slot");
      }
    }
  });

  test("each view links exactly the stylesheets of the components it renders", () => {
    assert.deepEqual(componentSheetViolations(catalogue), []);
  });

  test("shared design stylesheets keep their route scopes", () => {
    assert.deepEqual(scopeViolations(catalogue), []);
  });

  test("served view documents run no scripts", () => {
    assert.deepEqual(scriptViolations(catalogue), []);
  });

  test("every link opens an entry through one portable focus stop", () => {
    assert.deepEqual(linkViolations(catalogue), []);
  });

  test("outside the component explorer, no keyboard stop opens nothing", () => {
    assert.deepEqual(keyboardStopViolations(catalogue), []);
  });

  test("each control family opens its specified destinations", () => {
    assert.deepEqual(expectationViolations(catalogue), []);
  });

  test("Welcome's tag states agree on query, picker, chips, and rows", () => {
    assert.deepEqual(tagViolations(catalogue), []);
  });

  test("an artboard link or the catalogue tree reaches every design screen", () => {
    assert.deepEqual(reachabilityViolations(catalogue), []);
  });
});
