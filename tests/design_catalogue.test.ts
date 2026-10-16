import assert from "node:assert/strict";
import test from "node:test";

import type { ComponentInstanceRecord } from "../packages/viewer/src/generated/catalogue/ComponentInstanceRecord.js";

import {
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
import { bypassViolations } from "./helpers/design_sources.js";
import { fileFixture } from "./helpers/file_fixture.js";
import { serveExample } from "./helpers/served_design.js";

// The design catalogue checks of the design component, component library,
// component design, and design links contracts, over one served example.

/**
 * One Serve of the example for the file. Teardown drains its process group,
 * also after a failed setup, and a run that selects no served test starts no
 * Serve.
 */
const served = fileFixture((owner) =>
  // An expected-state allowance: Serve renders every view of the example.
  serveExample(owner, AbortSignal.timeout(300_000)),
);
/** The first test that reads the catalogue waits for the shared setup. */
const setup = { timeout: 600_000 };

test("composition outside the library uses the registered components", () => {
  assert.deepEqual(bypassViolations(), []);
});

test(
  "design screens match the frozen inventory in both viewports",
  setup,
  async () => {
    assert.deepEqual(inventoryViolations(await served()), []);
  },
);

test(
  "shared components keep their pages, saved variants, and consumers",
  setup,
  async () => {
    assert.deepEqual(libraryViolations(await served()), []);
  },
);

test(
  "each design view records the shared components of its family",
  setup,
  async () => {
    assert.deepEqual(adoptionViolations(await served()), []);
  },
);

test(
  "nested and caller-owned instances keep their owner chains",
  setup,
  async () => {
    const catalogue = await served();
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
  },
);

test(
  "each view links exactly the stylesheets of the components it renders",
  setup,
  async () => {
    assert.deepEqual(componentSheetViolations(await served()), []);
  },
);

test("shared design stylesheets keep their route scopes", setup, async () => {
  assert.deepEqual(scopeViolations(await served()), []);
});

test("served view documents run no scripts", setup, async () => {
  assert.deepEqual(scriptViolations(await served()), []);
});

test(
  "every link opens an entry through one portable focus stop",
  setup,
  async () => {
    assert.deepEqual(linkViolations(await served()), []);
  },
);

test(
  "outside the component explorer, no keyboard stop opens nothing",
  setup,
  async () => {
    assert.deepEqual(keyboardStopViolations(await served()), []);
  },
);

test(
  "each control family opens its specified destinations",
  setup,
  async () => {
    assert.deepEqual(expectationViolations(await served()), []);
  },
);

test(
  "Welcome's tag states agree on query, picker, chips, and rows",
  setup,
  async () => {
    assert.deepEqual(tagViolations(await served()), []);
  },
);

test(
  "an artboard link or the catalogue tree reaches every design screen",
  setup,
  async () => {
    assert.deepEqual(reachabilityViolations(await served()), []);
  },
);
