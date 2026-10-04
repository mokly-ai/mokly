import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { exportCatalogue } from "../dist/export/run.js";
import { publishCatalogue } from "../dist/publish/run.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import { startCatalogueServer } from "../dist/server/http.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { httpRequest } from "./helpers/http_request.js";

test("forwarded origin settings and Live preparation leave export and publication bytes unchanged", async (t) => {
  const fixture = await createExportFixture(undefined, {
    extraConfig: 'interactive: "serve",',
  });
  t.after(fixture.close);
  const receiver = await startFakeReceiver(t);
  const dependencies = {
    git: new NodeGitCommandRunner(fixture.root),
    export: exportCatalogue,
    now: () => new Date("2026-10-04T12:00:00.000Z"),
    random: () => 0,
    sleep: async () => undefined,
    fetch,
  };
  const publishOptions = {
    endpoint: receiver.endpoint,
    token: "fixture-token",
    repository: "github.com/sample/catalogue",
    noChanges: true,
    out: "publication",
  };
  const exported = await exportCatalogue(fixture.config, {
    outDir: "site",
    noChanges: true,
  });
  const beforeExport = await directoryFiles(exported.outDir);
  await publishCatalogue(
    fixture.config,
    publishOptions,
    "1.2.3",
    {},
    dependencies,
  );
  const beforePublication = await directoryFiles(
    path.join(fixture.root, "publication"),
  );

  const runtime = await prepareLiveRuntime(fixture.config);
  const appOrigin = "https://catalogue.example:8443";
  const interactiveOrigin = "https://live.example:9443";
  const server = await startCatalogueServer(runtime.config, {
    appOrigin,
    interactiveOrigin,
    base: "main",
    changesStatus: "unavailable",
    componentRuntime: runtime,
    manifest: runtime.manifest,
    port: 0,
  });
  fixture.beforeRemove(() => server.close());
  assert.equal(
    (
      await httpRequest(
        `${server.url}/__mokly/interactive/${runtime.generation}/prepare`,
        "POST",
        { host: new URL(appOrigin).host, origin: appOrigin },
      )
    ).status,
    200,
  );
  const catalogue = await httpRequest(
    `${server.url}/__mokly/catalogue.json`,
    "GET",
    { host: new URL(appOrigin).host },
  );
  assert.equal(catalogue.status, 200);
  assert.doesNotMatch(
    catalogue.body,
    /catalogue\.example|live\.example|appOrigin|interactiveOrigin/,
  );

  await exportCatalogue(fixture.config, { outDir: "site", noChanges: true });
  assert.deepEqual(await directoryFiles(exported.outDir), beforeExport);
  await publishCatalogue(
    fixture.config,
    publishOptions,
    "1.2.3",
    {},
    dependencies,
  );
  assert.deepEqual(
    await directoryFiles(path.join(fixture.root, "publication")),
    beforePublication,
  );
  assert.equal(receiver.plans.length, 2);
  assert.equal(receiver.publications.size, 1);
  for (const files of [beforeExport, beforePublication])
    for (const [name, bytes] of files) {
      if (!name.endsWith(".html") && !name.endsWith(".json")) continue;
      assert.doesNotMatch(
        bytes.toString(),
        /catalogue\.example|live\.example|data-mokly-host-capability-state|data-mokly-interactive|"interactiveOrigin"|"appOrigin"/,
        name,
      );
    }
});
