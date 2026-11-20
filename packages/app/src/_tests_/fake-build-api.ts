import { readFileSync } from "node:fs";

import { buildControlAddressPath, replaceApi } from "./api-server";
import { expect, test as base } from "./harness";

/** Use the fake runner for this journey and always restore the ordinary API. */
export const test = base.extend<{ fakeBuildApi: void }>({
  fakeBuildApi: [
    async ({ admitted }, runTest) => {
      void admitted;
      let started = false;
      try {
        await replaceApi("fake-build");
        started = true;
        await runTest();
      } finally {
        try {
          if (started) await control("DELETE", "/publish");
        } finally {
          await replaceApi("ordinary");
        }
      }
    },
    { auto: true },
  ],
});

/** Let the build upload after the browser has observed its running output. */
export async function releaseBuild(buildId: string): Promise<void> {
  await control("POST", `/publish/${encodeURIComponent(buildId)}`);
}

async function control(method: "DELETE" | "POST", path: string) {
  const origin = readFileSync(buildControlAddressPath, "utf8");
  const response = await fetch(origin + path, { method });
  expect(response.status, "the fake runner accepts the release").toBe(204);
}
