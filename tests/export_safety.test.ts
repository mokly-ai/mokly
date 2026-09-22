import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { runExport } from "../dist/cli/export.js";
import {
  RESERVATION_DIRECTORY,
  isReservationDirectory,
} from "../dist/export/reservation.js";
import { exportCatalogue } from "../dist/export/run.js";
import { exportReservation } from "../dist/export/transaction.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";

test("export excludes source and hidden files and refuses selected symlinks", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  for (const name of [".env", "source.tsx", "source.js.map"])
    await fs.promises.writeFile(path.join(fixture.mockupsDir, name), "private");
  const bytes = Buffer.from([0, 255, 1, 254]);
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "font.woff2"),
    bytes,
  );
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "font.css"),
    '@font-face { src: url("font.woff2"); }',
  );
  await exportCatalogue(fixture.config, { outDir: "site" });
  const files = await directoryFiles(fixture.output);
  assert.deepEqual(files.get("static/font.woff2"), bytes);
  assert.ok(
    ![...files.keys()].some((name) =>
      /\.env|source\.tsx|source\.js\.map/.test(name),
    ),
  );
  await fs.promises.symlink(
    path.join(fixture.root, "notes.md"),
    path.join(fixture.mockupsDir, "linked.txt"),
  );
  await assert.rejects(
    exportCatalogue(fixture.config, { outDir: "site" }),
    /symlink/,
  );
  assert.deepEqual(await directoryFiles(fixture.output), files);
});

test("cancellation drains work and retains the old artifact", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const previous = await directoryFiles(fixture.output);
  const controller = new AbortController();
  await assert.rejects(
    exportCatalogue(fixture.config, {
      outDir: "site",
      signal: controller.signal,
      adapter: { transform: () => controller.abort() },
    }),
    /cancelled/,
  );
  assert.deepEqual(await directoryFiles(fixture.output), previous);
  assert.equal(fs.existsSync(exportReservation(fixture.output)), false);
});

test("owned exports and active transactions do not trigger broad watch rules", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const watched = {
    ...fixture.config,
    watch: {
      debounceMs: 10,
      rules: [{ action: "rebuild" as const, paths: ["**/*"] }],
    },
  };
  const outputFile = path.join(fixture.output, "index.html");
  await exportCatalogue(fixture.config, {
    outDir: "site",
    adapter: {
      transform: () => {
        assert.equal(
          classifyWatchPath({ path: outputFile, kind: "change" }, watched),
          "ignore",
        );
        assert.equal(
          classifyWatchPath(
            {
              path: path.join(
                exportReservation(fixture.output),
                "stage/index.html",
              ),
              kind: "change",
            },
            watched,
          ),
          "ignore",
        );
      },
    },
  });
  assert.equal(
    classifyWatchPath({ path: outputFile, kind: "change" }, watched),
    "ignore",
  );
  assert.equal(
    classifyWatchPath(
      {
        path: path.join(fixture.root, ".mokly-export-notes.md"),
        kind: "change",
      },
      watched,
    ),
    "rebuild",
  );
});

test("export rejects references to excluded resources without damaging output", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const previous = await directoryFiles(fixture.output);
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "bad.css"),
    '@import ".secret.css";',
  );
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, ".secret.css"),
    "body {}",
  );
  await assert.rejects(
    exportCatalogue(fixture.config, { outDir: "site" }),
    /resource is unavailable/,
  );
  assert.deepEqual(await directoryFiles(fixture.output), previous);
});

test("export refuses an output-parent alias retargeted during generation", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const first = path.join(fixture.root, "first");
  const second = path.join(fixture.root, "second");
  const alias = path.join(fixture.root, "alias");
  await fs.promises.mkdir(first);
  await fs.promises.mkdir(second);
  await fs.promises.symlink(first, alias);
  await assert.rejects(
    exportCatalogue(fixture.config, {
      outDir: "alias/site",
      adapter: {
        transform: async () => {
          await fs.promises.unlink(alias);
          await fs.promises.symlink(second, alias);
        },
      },
    }),
    /changed its real location/,
  );
  assert.deepEqual(await fs.promises.readdir(first), [RESERVATION_DIRECTORY]);
  assert.ok(isReservationDirectory(path.join(first, RESERVATION_DIRECTORY)));
  assert.deepEqual(
    await fs.promises.readdir(path.join(first, RESERVATION_DIRECTORY, "locks")),
    [],
  );
  assert.deepEqual(await fs.promises.readdir(second), []);
});

test("CLI termination signals drain export and release signal handlers", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const listeners = process.listenerCount("SIGTERM");
  await assert.rejects(
    runExport(fixture.config, {
      outDir: "site",
      adapter: {
        transform: () => {
          process.emit("SIGTERM");
        },
      },
    }),
    /cancelled/,
  );
  assert.equal(process.listenerCount("SIGTERM"), listeners);
  assert.equal(fs.existsSync(fixture.output), false);
  assert.equal(fs.existsSync(exportReservation(fixture.output)), false);
});
