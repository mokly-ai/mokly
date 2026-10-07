import assert from "node:assert/strict";
import test from "node:test";

import { resolveConfig } from "../dist/config/validate.js";

for (const compatibility of [undefined, null, {}, { transformer: "bridge.ts" }])
  test(`removed compatibility config rejects ${JSON.stringify(compatibility)} before module loading`, () => {
    assert.throws(
      () => resolveConfig({ compatibility }, "/not-loaded/mokly.config.ts"),
      {
        code: "config-invalid",
        message:
          "[mokly/config-invalid] compatibility was removed; author portable links directly",
      },
    );
  });
