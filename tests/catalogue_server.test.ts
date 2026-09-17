import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalJson } from "../packages/viewer/dist/components/data.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { startEvidenceFixture } from "./helpers/evidence_fixture.js";

test("catalogue GET/HEAD reads atomic live snapshots without rendering or Git", async (t) => {
  const fixture = await startEvidenceFixture();
  t.after(() => fixture.close());
  const url = `${fixture.server.url}/__mokly/catalogue.json`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  const initial = await response.json();
  assert.equal(initial.changesStatus, "pending");
  assert.equal(initial.screens[0].views[0].usage.status, "pending");
  assert.equal(initial.comparisonUrl, null);
  assert.equal(
    initial.deploymentId,
    createHash("sha256")
      .update(
        `${canonicalJson({ ...initial, deploymentId: "0".repeat(64) }, 2)}\n`,
      )
      .digest("hex"),
  );
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal((await fetch(url, { method: "POST" })).status, 405);
  assert.deepEqual(await (await fetch(url)).json(), initial);
  assert.equal(fixture.comparisonRequests, 0);
  assert.equal(
    fixture.server.completeCatalogue!(
      fixture.compilation.manifest,
      "wrong-generation",
    ),
    false,
  );
  assert.deepEqual(await (await fetch(url)).json(), initial);
  assert.equal(
    fixture.server.completeCatalogue!(
      fixture.compilation.manifest,
      fixture.runtime.generation,
    ),
    true,
  );
  fixture.server.publishUpdate({
    kind: "evidence",
    changedRoutes: [],
    version: 2,
  });
  const complete = await (await fetch(url)).json();
  assert.equal(complete.revision.content, initial.revision.content);
  assert.ok(complete.revision.evidence > initial.revision.evidence);
  assert.equal(complete.screens[0].views[0].usage.status, "ready");
  assert.deepEqual(complete.screens[0].changes, {
    status: "ready",
    kind: "unmodified",
    included: false,
  });
  fixture.server.publishUpdate({ changesStatus: "pending", version: 3 });
  const changed = await (await fetch(url)).json();
  assert.ok(changed.revision.content > complete.revision.content);
  assert.equal(changed.changesStatus, "pending");
  fixture.server.publishUpdate({
    kind: "evidence",
    changedRoutes: [],
    version: 2,
  });
  assert.deepEqual(await (await fetch(url)).json(), changed);
  assert.equal(fixture.comparisonRequests, 0);
});

test("actual view usage refreshes evidence while failed complete candidates retain the last snapshot", async (t) => {
  const fixture = await startEvidenceFixture(componentEntrySource());
  t.after(() => fixture.close());
  const url = `${fixture.server.url}/__mokly/catalogue.json`;
  const initial = await (await fetch(url)).json();
  const response = await fetch(
    `${fixture.server.url}/__mokly/views/screens/home.mobile.html?generation=${fixture.runtime.generation}`,
  );
  assert.equal(response.status, 200);
  const rendered = await response.json();
  const visited = await (await fetch(url)).json();
  const home = visited.screens.find(
    (entry: { id: string }) => entry.id === "home",
  );
  assert.deepEqual(home.views[0].usage, {
    status: "ready",
    instances: rendered.usage.instances,
    slots: rendered.usage.slots,
    ranges: rendered.usage.ranges,
  });
  assert.equal(home.views[1].usage.status, "pending");
  assert.equal(visited.revision.content, initial.revision.content);
  assert.ok(visited.revision.evidence > initial.revision.evidence);
  const invalid = structuredClone(fixture.compilation.manifest);
  invalid.entries[0]!.sourcePath = "/outside/source.tsx";
  assert.throws(() =>
    fixture.server.completeCatalogue!(invalid, fixture.runtime.generation),
  );
  assert.deepEqual(await (await fetch(url)).json(), visited);
  fixture.server.publishUpdate({
    kind: "evidence",
    changesStatus: "unavailable",
    version: 2,
  });
  const failed = await (await fetch(url)).json();
  assert.equal(failed.screens[0].views[1].usage.status, "unavailable");
  assert.equal(failed.screens[0].views[0].usage.status, "ready");
});
