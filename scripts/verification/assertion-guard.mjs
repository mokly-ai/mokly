/** Load assertion accounting only in the test runner's own file process. */
import { register } from "node:module";

if (
  process.env.NODE_TEST_CONTEXT !== undefined &&
  process.env.MOKLY_ASSERTION_GUARD_PID === undefined
) {
  process.env.MOKLY_ASSERTION_GUARD_PID = String(process.pid);
  register("./assertion-guard-hooks.mjs", import.meta.url, {
    data: { root: new URL("../../", import.meta.url).href },
  });
  await import("./assertion-guard-runtime.mjs");
}
