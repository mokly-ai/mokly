import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
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
import { waitFor } from "./server_fixture.js";

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
          running.url + "/static/mokly-generated/home/index.mobile.html",
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

for (const build of [false, true]) {
  test(
    `watched Serve refreshes its authored closure after CSS additions and removals (build=${build})`,
    { timeout: 60_000 },
    async (t) => {
      const fixture = await createFixture(undefined, {
        extraConfig:
          'stylesheets: [{ match: "**", stylesheets: ["theme.css"] }], watch: { debounceMs: 0 },',
      });
      t.after(() => removeFixture(fixture));
      const stylesheet = path.join(fixture.mockupsDir, "theme.css");
      await fs.writeFile(stylesheet, 'main{background:url("a.svg")}');
      await fs.writeFile(path.join(fixture.mockupsDir, "a.svg"), "<svg/>");
      await fs.writeFile(
        path.join(fixture.mockupsDir, "b.svg"),
        '<svg width="42"/>',
      );
      const outputStore = new FileSystemGeneratedOutputStore();
      const completed = new Set<string>();
      const write = outputStore.write.bind(outputStore);
      t.mock.method(
        outputStore,
        "write",
        async (...args: Parameters<typeof write>) => {
          await write(...args);
          completed.add(JSON.stringify(args[0].manifest.assetClosure));
        },
      );
      const running = await serve(
        await loadConfig(fixture.root),
        { watch: true, build, port: 0 },
        { outputStore },
      );
      fixture.beforeRemove(() => running.close());
      await waitForInitialChanges(running.url);
      const manifest = path.join(fixture.generatedDir, "mokly-manifest.json");
      const checkClosure = async (expected: string[]) => {
        if (build) {
          await waitFor(async () => completed.has(JSON.stringify(expected)));
          assert.deepEqual(
            JSON.parse(await fs.readFile(manifest, "utf8")).assetClosure,
            expected,
          );
        } else
          await assert.rejects(fs.stat(fixture.generatedDir), {
            code: "ENOENT",
          });
      };
      await checkClosure(["a.svg", "theme.css"]);
      for (const target of ["b.svg", undefined]) {
        const before = version(await (await fetch(running.url)).text());
        await fs.writeFile(
          stylesheet,
          target ? `main{background:url("${target}")}` : "main{color:green}",
        );
        await waitForUpdate(running.url, before);
        await waitFor(
          async () =>
            (await fetch(running.url + "/static/b.svg")).status ===
            (target ? 200 : 404),
        );
        await checkClosure(target ? [target, "theme.css"] : ["theme.css"]);
      }
    },
  );
}
