import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { projectScopedCatalogue } from "../src/catalogue/scoped_projection.js";
import { shellFrameUsage } from "../src/shell/stage_sources.js";
import { inspectionAvailability } from "../src/shell/workspace_inspection_runtime.js";
import { WorkspaceInstances } from "../src/shell/workspace_instances.js";
import { WorkspaceProps } from "../src/shell/workspace_props.js";
import { WorkspaceUsage } from "../src/shell/workspace_usage.js";
import { viewerCatalogue } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import { scopedCatalogueFixture } from "./scoped_catalogue_fixture.js";

const complete = scopedCatalogueFixture();

test("omitted usage becomes pending instead of unavailable in frames", () => {
  assert.deepEqual(shellFrameUsage({ status: "omitted" }), {
    status: "pending",
  });
  assert.deepEqual(shellFrameUsage({ status: "unavailable" }), {
    status: "unavailable",
  });
});

test("a partial fallback derives no cross-route Usage or false empty state", () => {
  const scoped = projectScopedCatalogue(complete, {
    kind: "target",
    route: "components/action.html",
  });
  const catalogue = viewerCatalogue(scoped);
  const entry = catalogue.byRoute.get("components/action.html");
  assert.ok(entry?.kind === "component");
  const data = publicWorkspace(scoped, entry);
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

test("an out-of-scope workspace shows the mockup's inspection waiting copy", () => {
  const scoped = projectScopedCatalogue(complete, {
    kind: "target",
    route: "components/action.html",
  });
  const catalogue = viewerCatalogue(scoped);
  const entry = catalogue.byRoute.get("screens/home.html");
  assert.ok(entry?.kind === "screen");
  const data = publicWorkspace(scoped, entry);
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
