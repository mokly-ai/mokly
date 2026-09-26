import assert from "node:assert/strict";
import test from "node:test";

import { BuildWarningSink } from "../dist/build/warning_sink.js";
import type { BuildWarning } from "../dist/build/warnings.js";

const warning = (
  code: BuildWarning["code"],
  context: string[],
): BuildWarning => ({
  code,
  context,
  message: `${code}:${context.join(":")}`,
});

test("warnings deduplicate across phases, sort before readiness and repeat only after reset", () => {
  const emitted: string[] = [];
  const sink = new BuildWarningSink((item) => emitted.push(item.message));
  sink.add(warning("removed-shared-impact", ["/repo/config.ts"]));
  sink.add(warning("removed-dependencies", ["home"]));
  sink.add(warning("removed-dependencies", ["home"]));
  sink.flush();
  assert.deepEqual(emitted, [
    "removed-dependencies:home",
    "removed-shared-impact:/repo/config.ts",
  ]);
  sink.add(warning("removed-dependencies", ["home"]));
  sink.add(
    warning("ignored-declared-resource-owner", [
      "home.mobile.html",
      "/repo/action.css",
    ]),
  );
  assert.deepEqual(emitted.slice(-1), [
    "ignored-declared-resource-owner:home.mobile.html:/repo/action.css",
  ]);
  sink.reset();
  sink.add(warning("removed-dependencies", ["home"]));
  sink.flush();
  assert.equal(emitted.at(-1), "removed-dependencies:home");
});
