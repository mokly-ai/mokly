import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { pathFixture } from "./helpers/path_fixture.js";

test("Serve renders a path-addressed screen through the live workspace boundary", async (t) => {
  const fixture = await pathFixture({
    "specs/account/invoice.mockup.tsx": `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Invoice',description:'An invoice',relatedDocs:[],mobile:'Invoice',desktop:'Invoice'});`,
  });
  t.after(fixture.remove);
  const config = await fixture.config();
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, {
    port: 0,
    liveChanges: false,
    base: "HEAD",
  });
  t.after(() => server.close());
  for (const suffix of ["", "/", "/index.html"]) {
    const response = await fetch(`${server.url}/view/account/invoice${suffix}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Invoice/);
  }
});

test("Serve opens prototype-named paths with unavailable comparison evidence", async (t) => {
  const paths = ["constructor", "__proto__", "toString"];
  const fixture = await pathFixture(
    Object.fromEntries(
      paths.map((name) => [
        `specs/${name}.mockup.ts`,
        `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'${name}',description:'Prototype-named screen',relatedDocs:[],mobile:'${name}',desktop:'${name}'});`,
      ]),
    ),
  );
  t.after(fixture.remove);
  const config = await fixture.config();
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, {
    port: 0,
    liveChanges: false,
    base: "HEAD",
  });
  t.after(() => server.close());
  for (const name of paths) {
    const response = await fetch(`${server.url}/view/${name}/`);
    const html = await response.text();
    assert.equal(response.status, 200, html);
    assert.match(html, new RegExp(name));
  }
});
