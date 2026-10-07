import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { validEntrySource } from "./helpers/fixture.js";
import { runPublishedCli } from "./helpers/publish_process.js";

const token = "delta-receiver-token";
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const assetRoute =
  "mokly-generated/assets/entries/node_modules/@scope/pkg/mark.png";

for (const storage of ["blobs", "rebuild"] as const)
  test(`${storage} publish retains exact scoped binary bytes on both snapshot sides`, async (context) => {
    const fixture = await createExportFixture();
    context.after(() => fixture.close());
    const receiver = await startFakeReceiver(context, { token });
    const before = Buffer.from([0, 255, 3, 10, 0xc3, 0x28, 0xfe]);
    const after = Buffer.from([0, 255, 3, 11, 0xc3, 0x28, 0xfe, 0x80]);
    const scoped = path.join(fixture.entriesDir, "node_modules/@scope/pkg");
    await fs.mkdir(scoped, { recursive: true });
    await fs.writeFile(
      fixture.entryPath,
      validEntrySource({
        body: "<button className={classes.auth}>Sign in</button>",
      }) + '\nimport classes from "./theme.module.css";\n',
    );
    await fs.writeFile(
      path.join(fixture.entriesDir, "theme.module.css"),
      '.auth { background-image: url("./node_modules/@scope/pkg/mark.png"); color: red; }',
    );
    await fs.writeFile(path.join(scoped, "mark.png"), before);
    if (storage === "rebuild") {
      await fs.writeFile(
        fixture.configPath,
        (await fs.readFile(fixture.configPath, "utf8")).replace(
          'sharedImpact: ["notes.md"]',
          'sharedImpact: ["notes.md"], baselineBuild: [["node", "baseline.mjs"]]',
        ),
      );
      const config = await loadConfig(fixture.root);
      const compiled = await compileCatalogue(config);
      await fs.writeFile(
        path.join(fixture.root, "baseline.json"),
        JSON.stringify(
          [...compiled.outputs].map(([route, value]) => [
            route,
            Buffer.from(value).toString("base64"),
          ]),
        ),
      );
      await fs.writeFile(
        path.join(fixture.root, "baseline.mjs"),
        `import fs from "node:fs/promises";
import path from "node:path";
for (const [route, encoded] of JSON.parse(await fs.readFile("baseline.json", "utf8"))) {
  const target = path.join("mockups/mokly-generated", route);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, Buffer.from(encoded, "base64"));
}\n`,
      );
      await fs.writeFile(
        path.join(fixture.root, ".gitignore"),
        "mockups/**/*.html\nmockups/mokly-manifest.json\nmockups/mokly-generated/\n.mokly-cache/\nsite/\n",
      );
      await fixture.git("rm", "-r", "-q", "--cached", "mockups");
    } else {
      const config = await loadConfig(fixture.root);
      await writeCompilation(await compileCatalogue(config), config);
    }
    await fixture.git("add", ".");
    await fixture.git("commit", "-qm", "test: baseline with scoped asset");
    await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
    await fs.writeFile(path.join(scoped, "mark.png"), after);
    if (storage === "blobs") {
      const config = await loadConfig(fixture.root);
      await writeCompilation(await compileCatalogue(config), config);
    }

    await fixture.git("add", ".");
    await fixture.git("commit", "-qm", "test: publish changed scoped asset");

    await runPublishedCli(fixture.root, receiver.endpoint, token);
    const ownership = receiver.plans.at(-1)!.ownership.files;
    const byPath = new Map(ownership.map((entry) => [entry.path, entry]));
    const paths = [...byPath.keys()].filter((name) =>
      name.endsWith(assetRoute),
    );
    const current = `static/${assetRoute}`;
    const beforePath = paths.find((name) =>
      name.includes("/snapshots/before/"),
    );
    const afterPath = paths.find((name) => name.includes("/snapshots/after/"));
    assert.ok(beforePath, "before snapshot asset");
    assert.ok(afterPath, "after snapshot asset");
    const site = path.join(fixture.root, "site");
    const marker = JSON.parse(
      await fs.readFile(path.join(site, ".mokly-export-artifact"), "utf8"),
    ) as { files: typeof ownership };
    for (const [route, bytes] of [
      [current, after],
      [beforePath, before],
      [afterPath, after],
    ] as const) {
      const entry = byPath.get(route);
      assert.ok(entry, route);
      assert.equal(entry.sha256, digest(bytes), route);
      assert.equal(entry.size, bytes.length, route);
      assert.deepEqual(receiver.blobs.get(entry.sha256), bytes, route);
      assert.deepEqual(await fs.readFile(path.join(site, route)), bytes, route);
      assert.ok(
        marker.files.some((owned) => owned.path === route),
        route,
      );
    }
    assert.ok(receiver.puts.includes(digest(before)));
    assert.ok(receiver.puts.includes(digest(after)));
  });
