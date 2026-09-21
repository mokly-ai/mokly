import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";

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
  context.after(() => server.close());

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
  assert.equal(
    (await fetch(`${server.url}/__mokly/client/react-host.js`)).status,
    200,
  );
  assert.match(
    await (await fetch(`${server.url}/__mokly/client/react-host.js`)).text(),
    /\.\/react-shell\.js/,
  );
  assert.equal(
    (await fetch(`${server.url}/__mokly/client/unknown.js`)).status,
    404,
  );
});
