import assert from "node:assert/strict";
import { test } from "node:test";

import { FrameError } from "../src/client/frame_error.js";
import { viewerFailures } from "../src/viewer/failures.js";
import {
  InspectionOwnership,
  ObsoleteInspection,
} from "../src/viewer/inspection_work.js";

for (const fail of [true, false]) {
  test(`obsolete ${fail ? "failure" : "success"} settles before a custom adapter finishes`, async () => {
    const owner = new InspectionOwnership(() => true);
    let finish!: () => void;
    const failures: unknown[] = [];
    const pending = owner.work().run(
      () =>
        new Promise<void>((resolve, reject) => {
          finish = () =>
            fail ? reject(new Error("Delayed failure")) : resolve();
        }),
      (error) => {
        failures.push(error);
        return error as Error;
      },
    );
    const rejected = assert.rejects(pending, { code: "disposed" });
    owner.reset();
    await rejected;
    await owner.work().run(async () => "replacement");
    finish();
    await Promise.resolve();
    assert.deepEqual(failures, []);
  });
}

test("ownership fences errors queued before a replacement and blocks later stages", async () => {
  const owner = new InspectionOwnership(() => true);
  const work = owner.work();
  let measured = false;
  const pending = work.run(async () => {
    await Promise.resolve();
    work.check();
    measured = true;
  });
  const rejected = assert.rejects(pending, { code: "disposed" });
  owner.reset();
  await rejected;
  assert.equal(measured, false);
  assert.equal(work.current(), false);
});

test("only internal obsolescence suppresses reports; current adapter errors still report once", async () => {
  const errors: unknown[] = [];
  const owner = new InspectionOwnership(() => true);
  const report = viewerFailures(
    () => ({ onError: (error) => errors.push(error) }),
    () => true,
  );
  const obsolete = new ObsoleteInspection();
  assert.equal(report(obsolete, "frame"), obsolete);
  const failure = new FrameError("disposed");
  await assert.rejects(
    owner.work().run(
      async () => {
        throw failure;
      },
      (error) => report(error, "frame"),
    ),
  );
  report(failure, "frame");
  assert.equal(errors.length, 1);
});
