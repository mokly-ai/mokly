import assert from "node:assert/strict";
import { AsyncLocalStorage, createHook } from "node:async_hooks";
import test from "node:test";

import { compareComponentViews } from "../dist/review/component_compare_views.js";
import { ComponentDependencyPolicy } from "../dist/review/component_metadata.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("disabled view instrumentation creates no promises beyond the delivered comparison batch", async (testContext) => {
  const fixture = await componentReviewFixture(testContext, (source) => source);
  const reader = (outputs: ReadonlyMap<string, string | Uint8Array>) =>
    new ComponentMaterialReader({
      read: async (route: string) => Buffer.from(outputs.get(route)!),
    });
  const context = () => {
    const beforeReader = reader(fixture.before.outputs);
    const afterReader = reader(fixture.after.outputs);
    const changed = new Set<string>();
    return {
      componentAware: true,
      beforeReader,
      afterReader,
      dependencies: new ComponentDependencyPolicy(
        fixture.before.manifest,
        fixture.after.manifest,
        [],
      ),
      changed,
      prefix: "mockups",
      resources: new ResourceComparison(
        beforeReader,
        afterReader,
        changed,
        "mockups",
      ),
    };
  };
  const views = (side: typeof fixture.before) =>
    generatedViews(
      side.manifest.entries.find(({ path: id }) => id === "home")!,
    );
  const before = views(fixture.before);
  const after = views(fixture.after);
  const pairs = before.map((view, index) => ({
    before: view,
    after: after[index]!,
  }));
  const originalContext = context();
  const delivered = await observePromises(() =>
    Promise.all(
      pairs.map((view) =>
        compareComponentView(originalContext, view.before, view.after),
      ),
    ),
  );
  const instrumentedContext = context();
  const instrumented = await observePromises(() =>
    compareComponentViews(instrumentedContext, pairs),
  );
  assert.deepEqual(instrumented.value, delivered.value);
  assert.equal(instrumented.promises, delivered.promises);
});

async function observePromises<T>(operation: () => Promise<T>) {
  const scope = new AsyncLocalStorage<boolean>();
  let promises = 0;
  const hook = createHook({
    init(_asyncId, type) {
      if (type === "PROMISE" && scope.getStore()) promises += 1;
    },
  });
  hook.enable();
  try {
    const value = await scope.run(true, operation);
    return { value, promises };
  } finally {
    hook.disable();
    scope.disable();
  }
}
