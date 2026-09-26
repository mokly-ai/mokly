import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";
import {
  readViewerCapabilityDescriptor,
  serializeViewerCapabilityDescriptor,
} from "../packages/viewer/dist/client/host_capability_descriptor.js";
import {
  readScopedShellBootstrap,
  serializeShellBootstrap,
} from "../packages/viewer/dist/runtime.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("every served document loads the hydrated live host", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, {
    base: "origin/main",
    port: 0,
  });
  fixture.beforeRemove(() => server.close());

  for (const route of ["/", "/review", "/view/screens/home.html", "/absent"]) {
    const document = await (await fetch(`${server.url}${route}`)).text();
    assert.match(
      document,
      /<script src="\/__mokly\/client\/react-host\.js" type="module"><\/script>/,
      route,
    );
  }
  const reactDocument = await (
    await fetch(`${server.url}/view/screens/home.html`)
  ).text();
  assert.match(reactDocument, /data-mokly-host-capabilities=""/);
  const capabilityState = reactDocument.match(
    /data-mokly-host-capability-state="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  assert.ok(capabilityState);
  const bootstrapState = reactDocument.match(
    /data-mokly-shell-bootstrap="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  assert.ok(bootstrapState);
  assert.equal(
    serializeShellBootstrap(
      readScopedShellBootstrap(JSON.parse(bootstrapState)),
    ),
    bootstrapState,
  );
  assert.equal(
    serializeViewerCapabilityDescriptor(
      readViewerCapabilityDescriptor(JSON.parse(capabilityState)),
    ),
    capabilityState,
  );
  const capability = JSON.parse(capabilityState) as {
    workspace: Record<string, unknown> & {
      affected: unknown[];
      inputChanges: unknown[];
      relatedComponents: unknown[];
    };
  };
  assert.ok(capability.workspace);
  assert.ok(Array.isArray(capability.workspace.affected));
  assert.ok(Array.isArray(capability.workspace.inputChanges));
  assert.ok(Array.isArray(capability.workspace.relatedComponents));
  assert.equal("renderCapability" in capability.workspace, false);
  assert.doesNotMatch(
    reactDocument,
    /<script src="\/__mokly\/client\/(?:browse|browser)\.js"/,
  );
  for (const retired of [
    "browse.js",
    "browse_state.js",
    "browse_navigation.js",
    "browser.js",
    "live_updates.js",
  ])
    assert.equal(
      (await fetch(`${server.url}/__mokly/client/${retired}`)).status,
      404,
      retired,
    );
  assert.equal(
    (await fetch(`${server.url}/__mokly/client/react-shell.js`)).status,
    200,
  );
  const appearance = await fetch(
    `${server.url}/__mokly/client/appearance-startup.js`,
  );
  assert.equal(appearance.status, 200);
  assert.match(await appearance.text(), /mokly:theme/);
  assert.equal(
    (await fetch(`${server.url}/__mokly/client/react-host.js`)).status,
    200,
  );
  const liveHost = await (
    await fetch(`${server.url}/__mokly/client/react-host.js`)
  ).text();
  assert.match(liveHost, /\.\/react-shell\.js/);
  assert.doesNotMatch(liveHost, /hydrateRoot/);
  const publicCatalogue = await (
    await fetch(`${server.url}/__mokly/catalogue.json`)
  ).json();
  assert.doesNotThrow(() => readCatalogue(publicCatalogue));
  assert.doesNotMatch(JSON.stringify(publicCatalogue), /"status":"omitted"/);
  assert.equal(
    (await fetch(`${server.url}/__mokly/client/unknown.js`)).status,
    404,
  );
});
