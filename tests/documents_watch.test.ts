import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { readCatalogue } from "@mokly/viewer";

import { PlainServeReporter } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import {
  version,
  waitForChangedCount,
  waitForClassifiedCount,
} from "./helpers/watched_catalogue.js";

test(
  "Watch discovers, changes and removes a Markdown entry",
  { timeout: 90_000 },
  async (t) => {
    const fixture = await changedFixture(t, validEntrySource(), {
      extraConfig: "watch: {debounceMs:0},",
    });
    const running = await serve(fixture.config, {
      base: "main",
      port: 0,
      watch: true,
    });
    fixture.beforeRemove(() => running.close());
    let html = await waitForClassifiedCount(running.url, 0);
    const document = path.join(fixture.entriesDir, "guide.md");
    const model = async () =>
      readCatalogue(
        await (await fetch(`${running.url}/__mokly/catalogue.json`)).json(),
      );

    await fs.writeFile(document, "# Added guide\n\nStart here.");
    html = await waitForChangedCount(running.url, version(html), 1);
    assert.deepEqual(
      (await model()).documents.map((entry) => [entry.path, entry.title]),
      [["guide", "Added guide"]],
    );
    assert.ok(
      (
        await (await fetch(`${running.url}/static/guide/index.html`)).text()
      ).includes("Start here."),
    );

    await fs.writeFile(
      document,
      "# Revised guide\n\nFollow the new instructions.",
    );
    html = await waitForChangedCount(running.url, version(html), 1);
    assert.equal((await model()).documents[0]?.title, "Revised guide");
    assert.ok(
      (
        await (await fetch(`${running.url}/static/guide/index.html`)).text()
      ).includes("Follow the new instructions."),
    );

    await fs.unlink(document);
    await waitForChangedCount(running.url, version(html), 0);
    assert.deepEqual((await model()).documents, []);
    assert.equal((await fetch(`${running.url}/view/guide/`)).status, 404);
    assert.equal(
      (await fetch(`${running.url}/static/guide/index.html`)).status,
      404,
    );
  },
);

test(
  "Watch changes, removes and restores a referenced Markdown resource",
  { timeout: 90_000 },
  async (t) => {
    const svg = (fill: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="${fill}"/></svg>`;
    const fixture = await changedFixture(
      t,
      validEntrySource(),
      { extraConfig: "watch: {debounceMs:0}," },
      async (f) => {
        await fs.writeFile(
          path.join(f.entriesDir, "guide.md"),
          "# Guide\n\n![Diagram](diagram.svg)",
        );
        await fs.writeFile(path.join(f.entriesDir, "diagram.svg"), svg("red"));
      },
    );
    const diagnostics: string[] = [];
    const running = await serve(
      fixture.config,
      { base: "main", port: 0, watch: true },
      {
        reporter: new PlainServeReporter((value) => diagnostics.push(value)),
      },
    );
    fixture.beforeRemove(() => running.close());
    let html = await waitForClassifiedCount(running.url, 0);
    const resource = path.join(fixture.entriesDir, "diagram.svg");
    const copied = async () =>
      (await fetch(`${running.url}/static/diagram.svg`)).text();

    await fs.writeFile(resource, svg("blue"));
    html = await waitForChangedCount(running.url, version(html), 1);
    assert.equal(await copied(), svg("blue"));

    await fs.unlink(resource);
    const missing =
      "[mokly/build-invalid] entries/guide.md: link target diagram.svg does not exist\n";
    const deadline = Date.now() + 20_000;
    while (!diagnostics.includes(missing) && Date.now() < deadline)
      await setTimeout(25);
    assert.ok(diagnostics.includes(missing), diagnostics.join(""));
    assert.equal(await copied(), svg("blue"));

    await fs.writeFile(resource, svg("green"));
    await waitForChangedCount(running.url, version(html), 1);
    assert.equal(await copied(), svg("green"));
  },
);
