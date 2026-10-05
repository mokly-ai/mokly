import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import {
  version,
  waitForInitialChanges,
  waitForUpdate,
} from "./helpers/watched_catalogue.js";

test(
  "watched Serve keeps authored page and PDF links after background and resource updates",
  { timeout: 30_000 },
  async (t) => {
    const fixture = await createFixture(
      validEntrySource({
        body: '<a href="../../guide.html">Guide</a><a href="../../spec.pdf">PDF</a>',
      }),
      { extraConfig: "watch: { debounceMs: 0 }," },
    );
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.mockupsDir, "guide.html"),
      '<link rel="stylesheet" href="guide.css"><p>Guide</p>',
    );
    await fs.writeFile(
      path.join(fixture.mockupsDir, "guide.css"),
      "p { color: blue }",
    );
    await fs.writeFile(
      path.join(fixture.mockupsDir, "spec.pdf"),
      "%PDF-1.4\nfirst",
    );
    const running = await serve(await loadConfig(fixture.root), {
      watch: true,
      port: 0,
    });
    fixture.beforeRemove(() => running.close());
    assert.equal(
      (
        await fetch(
          running.url + "/static/mokly-generated/screens/home.mobile.html",
        )
      ).status,
      200,
    );
    const initial = await waitForInitialChanges(running.url);
    for (const name of ["guide.html", "guide.css", "spec.pdf"])
      assert.equal(
        (await fetch(running.url + "/static/" + name)).status,
        200,
        name,
      );
    await fs.writeFile(
      path.join(fixture.mockupsDir, "spec.pdf"),
      "%PDF-1.4\nsecond",
    );
    await waitForUpdate(running.url, version(initial));
    assert.equal(
      await (await fetch(running.url + "/static/spec.pdf")).text(),
      "%PDF-1.4\nsecond",
    );
    await fs.mkdir(path.join(fixture.mockupsDir, ".private"));
    await fs.writeFile(
      path.join(fixture.mockupsDir, ".private/secret.svg"),
      "secret",
    );
    const before = version(await (await fetch(running.url)).text());
    await fs.writeFile(
      path.join(fixture.mockupsDir, "guide.css"),
      'p { background: url(".private/secret.svg") }',
    );
    await waitForUpdate(running.url, before);
    assert.equal(
      (await fetch(running.url + "/static/.private/secret.svg")).status,
      404,
    );
  },
);
