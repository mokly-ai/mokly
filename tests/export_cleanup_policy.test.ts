import assert from "node:assert/strict";
import test from "node:test";

import { errorMessage, isCancellation, MoklyError } from "../dist/errors.js";
import {
  failAfterExportCleanup,
  withExportCleanup,
} from "../dist/export/cleanup.js";

test("cleanup runs once after successful work and returns the original result", async () => {
  const events: string[] = [];
  const result = { installed: true };
  assert.equal(
    await withExportCleanup(
      async () => {
        events.push("work");
        return result;
      },
      async () => {
        events.push("cleanup");
      },
    ),
    result,
  );
  assert.deepEqual(events, ["work", "cleanup"]);
});

test("a lone operation or cleanup failure keeps its original error identity", async () => {
  const original = new Error("Original failure");
  let cleaned = 0;
  await assert.rejects(
    withExportCleanup(
      async () => {
        throw original;
      },
      async () => {
        cleaned++;
      },
    ),
    (error) => error === original,
  );
  assert.equal(cleaned, 1);
  await assert.rejects(
    withExportCleanup(
      async () => 1,
      async () => {
        throw original;
      },
    ),
    (error) => error === original,
  );
});

test("combined failures retain causal order even when the primary thrown value is undefined", async () => {
  const secondary = new Error("Cleanup failed");
  await assert.rejects(
    withExportCleanup(
      async () => {
        throw undefined;
      },
      async () => {
        throw secondary;
      },
    ),
    (error: unknown) => {
      assert.match(
        errorMessage(error),
        /Export failed: undefined\nCleanup also failed: Cleanup failed/,
      );
      assert.ok(
        error instanceof Error && error.cause instanceof AggregateError,
      );
      assert.deepEqual(error.cause.errors, [undefined, secondary]);
      return true;
    },
  );
});

test("reservation cleanup failure outranks a cancellation mark", async () => {
  const cancellation = new MoklyError("export-invalid", "Export cancelled", {
    cancelled: true,
  });
  const reservation = "/repo/.mokly-export-reservations/site";
  await assert.rejects(
    failAfterExportCleanup(cancellation, async () => {
      throw new MoklyError(
        "export-invalid",
        `Export cleanup failed; owned temporary files remain at ${reservation}.`,
      );
    }),
    (error: unknown) => {
      assert.equal(isCancellation(error), false);
      assert.match(errorMessage(error), new RegExp(reservation, "u"));
      return true;
    },
  );
});
