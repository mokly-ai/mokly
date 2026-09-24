import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { version, waitForUpdate } from "./helpers/watched_catalogue.js";

for (const watch of [false, true]) {
  test(`Serve indexes without rendering unrelated documents (watch=${watch})`, async (t) => {
    const fixture = await createFixture(
      validEntrySource() +
        `
      import { definePage } from "@mokly/mokly";
      mockups.push(definePage({ id: "broken", title: "Broken", description: "Broken page",
        route: "broken.html", relatedDocs: [],
        render: () => { throw new Error("unrequested page rendered"); } }));
    `,
    );
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const running = await serve(config, { watch, port: 0 });
    fixture.beforeRemove(() => running.close());
    const home = await (await fetch(running.url)).text();
    assert.match(home, /data-entry-id="broken"/);
    assert.match(home, /Search catalogue/);
    const preview = await fetch(
      `${running.url}/static/screens/home.desktop.html`,
    );
    assert.equal(preview.status, 200);
    assert.match(await preview.text(), /id="home"/);
    assert.equal(
      (await fetch(`${running.url}/static/broken.html`)).status,
      500,
    );
    assert.equal((await fetch(running.url)).status, 200);
    assert.equal(
      (await fetch(`${running.url}/static/../entries/fixture.mockup.tsx`))
        .status,
      404,
    );
    await assert.rejects(compileCatalogue(config), /unrequested page rendered/);
    assert.deepEqual(await fs.readdir(fixture.mockupsDir), []);
  });
}

test("demand rendering validates logical anchors without rendering navigation-only targets", async (t) => {
  const fixture = await createFixture(
    validEntrySource({ body: '<a href="mock:details#missing">Details</a>' }),
  );
  t.after(() => removeFixture(fixture));
  const running = await serve(await loadConfig(fixture.root), {
    watch: false,
    port: 0,
  });
  fixture.beforeRemove(() => running.close());
  const response = await fetch(
    `${running.url}/static/screens/home.desktop.html`,
  );
  assert.equal(response.status, 500);
  assert.match(await response.text(), /missing/);
  assert.equal(
    (await fetch(`${running.url}/view/screens/details.html?fragment=missing`))
      .status,
    400,
  );
  await assert.rejects(
    fs.access(path.join(fixture.mockupsDir, "mokly-manifest.json")),
  );
});

test(
  "visited resources stay watched before exhaustive output can complete",
  { timeout: 20000 },
  async (t) => {
    const fixture = await createFixture(
      validEntrySource({ body: '<img src="../image.svg" alt="Example" />' }) +
        `
    import { definePage } from "@mokly/mokly";
    mockups.push(definePage({ id: "broken", title: "Broken", description: "Broken page",
      route: "broken.html", relatedDocs: [],
      render: () => { throw new Error("background cannot complete"); } }));
  `,
    );
    t.after(() => removeFixture(fixture));
    const asset = path.join(fixture.mockupsDir, "image.svg");
    await fs.writeFile(asset, "<svg/>");
    const running = await serve(await loadConfig(fixture.root), {
      watch: true,
      port: 0,
    });
    fixture.beforeRemove(() => running.close());
    assert.equal(
      (await fetch(`${running.url}/static/screens/home.desktop.html`)).status,
      200,
    );
    const before = version(await (await fetch(running.url)).text());
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fs.writeFile(asset, '<svg width="20"/>');
    await waitForUpdate(running.url, before);
    assert.equal(
      (await fetch(`${running.url}/static/screens/home.desktop.html`)).status,
      200,
    );
    await assert.rejects(
      fs.access(path.join(fixture.mockupsDir, "mokly-manifest.json")),
    );
  },
);
