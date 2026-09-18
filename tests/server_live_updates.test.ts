import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("every served document loads the browser update client", async (context) => {
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
      /<script src="\/__mokly\/client\/browser\.js" type="module"><\/script>/,
      route,
    );
  }
  const browseDocument = await (
    await fetch(`${server.url}/view/screens/home.html`)
  ).text();
  const browseClient = browseDocument.indexOf(
    '<script src="/__mokly/client/browse.js" type="module"></script>',
  );
  const updateClient = browseDocument.indexOf(
    '<script src="/__mokly/client/browser.js" type="module"></script>',
  );
  assert.ok(browseClient >= 0 && browseClient < updateClient);
  const reactDocument = await (
    await fetch(`${server.url}/view/screens/home.html`, {
      headers: { "x-mokly-shell": "react" },
    })
  ).text();
  assert.match(
    reactDocument,
    /<script src="\/__mokly\/client\/react-shell\.js" type="module"><\/script>/,
  );
  assert.doesNotMatch(
    reactDocument,
    /<script src="\/__mokly\/client\/(?:browse|browser)\.js"/,
  );
  const browser = await fetch(`${server.url}/__mokly/client/browser.js`);
  assert.equal(browser.status, 200);
  assert.match(browser.headers.get("content-type") ?? "", /javascript/);
  assert.match(await browser.text(), /EventSource/);
  assert.equal(
    (await fetch(`${server.url}/__mokly/client/browse_state.js`)).status,
    200,
  );
  assert.equal(
    (await fetch(`${server.url}/__mokly/client/browse_navigation.js`)).status,
    200,
  );
  assert.equal(
    (await fetch(`${server.url}/__mokly/client/live_updates.js`)).status,
    200,
  );
  assert.equal(
    (await fetch(`${server.url}/__mokly/client/react-shell.js`)).status,
    200,
  );
  assert.equal(
    (await fetch(`${server.url}/__mokly/client/unknown.js`)).status,
    404,
  );
});
