import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { shellFrameUsage } from "../src/shell/stage_sources.js";
import { inspectionAvailability } from "../src/shell/workspace_inspection_runtime.js";
import { WorkspaceInstances } from "../src/shell/workspace_instances.js";
import { WorkspaceProps } from "../src/shell/workspace_props.js";
import { WorkspaceUsage } from "../src/shell/workspace_usage.js";
import { viewerCatalogue } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import {
  heldDetails,
  rawDetailFixtures,
  shellModelFixture,
} from "./catalogue_v7_fixture.js";

const COMPONENT = ["components/action", "components/action/default"];

/** The working model while the shell holds only the given entries' details. */
function holding(paths: readonly string[]) {
  const model = shellModelFixture(undefined, heldDetails(paths));
  return { catalogue: viewerCatalogue(model), model };
}

test("omitted usage becomes pending instead of unavailable in frames", () => {
  assert.deepEqual(shellFrameUsage({ status: "omitted" }), {
    status: "pending",
  });
  assert.deepEqual(shellFrameUsage({ status: "unavailable" }), {
    status: "unavailable",
  });
});

test("a workspace without its held detail derives no cross-route Usage or false empty state", () => {
  // Every other entry's detail is held; the routed component's is not.
  const { catalogue, model } = holding(
    Object.keys(rawDetailFixtures().current).filter(
      (path) => !COMPONENT.includes(path),
    ),
  );
  const entry = catalogue.byPath.get("components/action");
  assert.ok(entry?.kind === "component");
  const data = publicWorkspace(catalogue, model, entry);
  assert.deepEqual(data.usedBy, []);
  assert.deepEqual(data.affected, []);

  const loading = renderToStaticMarkup(
    <WorkspaceUsage data={data} delivery={{ status: "loading" }} />,
  );
  assert.match(loading, /Loading usage…/);
  assert.doesNotMatch(loading, /No recorded consumers/);
  assert.doesNotMatch(loading, /Used by/);

  let retries = 0;
  const failed = renderToStaticMarkup(
    <WorkspaceUsage
      data={data}
      delivery={{ status: "failed", retry: () => (retries += 1) }}
    />,
  );
  assert.match(failed, /Usage couldn’t be loaded\./);
  assert.match(failed, />Try again</);
  assert.doesNotMatch(failed, /No recorded consumers/);
  assert.equal(retries, 0);
});

test("a workspace whose detail is not held shows the mockup's inspection waiting copy", () => {
  const { catalogue, model } = holding(COMPONENT);
  const entry = catalogue.byPath.get("product/browse/home");
  assert.ok(entry?.kind === "screen");
  const data = publicWorkspace(catalogue, model, entry);
  assert.equal(data.viewUsagePending, true);
  const views = data.views.filter(({ colorScheme }) => colorScheme === "light");

  const instances = renderToStaticMarkup(
    <WorkspaceInstances
      activeViewport="desktop"
      data={data}
      onFocus={() => undefined}
      onSelect={() => undefined}
      onViewport={() => undefined}
      views={views}
    />,
  );
  assert.match(instances, /Waiting for the component preview\./);
  assert.doesNotMatch(instances, /inspection is unavailable/);

  const props = renderToStaticMarkup(
    <WorkspaceProps data={data} selection={{}} />,
  );
  assert.match(props, /Waiting for the component preview\./);
  assert.equal(
    inspectionAvailability(
      {
        comparisonActive: false,
        data,
        invalidSelection: false,
        views,
      },
      [],
    ).reason,
    "Waiting for the component preview.",
  );
});

test("a selected comparison says so and names where highlighting works", () => {
  const { catalogue, model } = holding(COMPONENT);
  const entry = catalogue.byPath.get("components/action");
  assert.ok(entry?.kind === "component");
  const data = publicWorkspace(catalogue, model, entry);
  assert.deepEqual(
    inspectionAvailability(
      {
        comparisonActive: true,
        data,
        invalidSelection: false,
        views: data.views,
      },
      [],
    ),
    {
      available: false,
      reason: "A comparison is selected. Highlighting is available in Current.",
    },
  );
});
