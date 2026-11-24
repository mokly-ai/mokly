import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import type { ComponentInstanceRecord } from "../packages/model/dist/index.js";

import {
  inventoryViolations,
  libraryViolations,
  reachabilityViolations,
  scopeViolations,
} from "./helpers/design_catalogue_checks.js";
import { highlightViolations } from "./helpers/design_highlight.js";
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
import {
  serveExample,
  viewRoute,
  type ServedCatalogue,
  type ServedView,
} from "./helpers/served_design.js";

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
    // The open tag picker of the Canvas search.
    for (const instances of usage("design/canvas/search/tags")) {
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
    // The Canvas use case: its step frames in encounter order, each with its
    // step's number, its title and the screen that the title opens. Every
    // frame of a step comes before the next step's frames, and the artboard
    // owns each frame.
    for (const instances of usage("design/canvas/flows/tour")) {
      const frames = of("canvas/canvas-frame", instances).sort(
        (a, b) => a.order - b.order,
      );
      const steps = frames.map(({ props }) =>
        JSON.stringify([props.step, props.label, props.screenDestination]),
      );
      assert.deepEqual(
        steps.filter((step, index) => step !== steps[index - 1]),
        [
          [
            ["number", "1"],
            ["string", "Welcome"],
            ["string", "design/canvas/overview"],
          ],
          [
            ["number", "2"],
            ["string", "Details"],
            ["string", "design/canvas/outcomes/added"],
          ],
        ].map((step) => JSON.stringify(step)),
      );
      for (const frame of frames) assert.equal(frame.owner.kind, "entry");
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

test("design views reject unmarked external hrefs", () => {
  const anchors = `
    <a href="http://example.test/">HTTP</a>
    <a href="https://example.test/">HTTPS</a>
    <a href="mailto:design@example.test">Email</a>
    <a href="#section">Section</a>
    <a>Placeholder</a>
  `;
  const view = (path: string): ServedView => ({
    path,
    kind: "screen",
    viewport: "desktop",
    colorScheme: "light",
    route: viewRoute(path, "desktop", "light"),
    document: parse(anchors),
  });
  const design = view("design/screen");
  const catalogue: ServedCatalogue = {
    index: {
      schemaVersion: 9,
      identity: { id: "fixture", title: "Link check" },
      deploymentId: "fixture",
      revision: 0,
      changesStatus: "unavailable",
      comparisonUrl: null,
      tree: [],
      screens: [],
      pages: [],
      documents: [],
      useCases: [],
      components: [],
      removedEntries: [],
    },
    details: new Map(),
    views: [design, view("example/screen")],
  };
  assert.deepEqual(linkViolations(catalogue), [
    `${design.route}: "HTTP" has an unmarked href http://example.test/`,
    `${design.route}: "HTTPS" has an unmarked href https://example.test/`,
    `${design.route}: "Email" has an unmarked href mailto:design@example.test`,
  ]);
});

test(
  "every link opens an entry through one portable focus stop",
  setup,
  async () => {
    assert.deepEqual(linkViolations(await served()), []);
  },
);

test("no design keyboard stop opens nothing", setup, async () => {
  assert.deepEqual(keyboardStopViolations(await served()), []);
});

test(
  "each artboard draws Highlight components in the shell's state",
  setup,
  async () => {
    assert.deepEqual(highlightViolations(await served()), []);
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
