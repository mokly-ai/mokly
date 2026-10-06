import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { runExport } from "../packages/mokly/dist/cli/export.js";
import { errorMessage, MoklyError } from "../packages/mokly/dist/errors.js";
import { fileExportOperations } from "../packages/mokly/dist/export/operations.js";
import { exportCatalogue } from "../packages/mokly/dist/export/run.js";

import { createExportFixture } from "./helpers/export_fixture.js";

test("export preserves the primary failure when reservation cleanup also fails", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const primary = new MoklyError(
    "export-invalid",
    "Primary generation failure",
  );
  context.mock.method(fileExportOperations, "remove", async () => {
    throw new Error("Injected cleanup failure");
  });
  await assert.rejects(
    exportCatalogue(fixture.config, {
      outDir: "site",
      adapter: {
        transform: () => {
          throw primary;
        },
      },
    }),
    (error: unknown) => {
      assert.match(errorMessage(error), /Primary generation failure/);
      assert.match(
        errorMessage(error),
        /cleanup failed.*reservation|cleanup failed.*temporary/,
      );
      assert.ok(
        error instanceof Error && error.cause instanceof AggregateError,
      );
      assert.equal(error.cause.errors[0], primary);
      return true;
    },
  );
});

test("the CLI export boundary retains rollback failure and recovery diagnostics", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fs.promises.mkdir(fixture.output);
  const listeners = process.listenerCount("SIGTERM");
  context.mock.method(
    fileExportOperations,
    "rename",
    async (from: string, to: string) => {
      if (from === fixture.output) return fs.promises.rename(from, to);
      throw new Error(
        from.endsWith("/stage")
          ? "Injected install failure"
          : "Injected restore failure",
      );
    },
  );
  await assert.rejects(
    runExport(fixture.config, { outDir: "site" }),
    (error: unknown) => {
      assert.match(errorMessage(error), /rollback failed/);
      assert.match(errorMessage(error), /recovery files retained/);
      assert.ok(
        error instanceof Error && error.cause instanceof AggregateError,
      );
      assert.match(errorMessage(error.cause.errors[0]), /rollback failed/);
      return true;
    },
  );
  assert.equal(process.listenerCount("SIGTERM"), listeners);
  assert.ok(
    fs.existsSync(
      path.join(fixture.root, ".mokly-export-reservations/locks/site/backup"),
    ),
  );
});
