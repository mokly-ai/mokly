import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import { build } from "esbuild";

import type {} from "../helpers/frame_initialization.js";

let script: string;
test.beforeAll(async () => {
  const result = await build({
    bundle: true,
    define: { "process.env.NODE_ENV": '"production"' },
    entryPoints: [
      fileURLToPath(
        new URL("../helpers/frame_initialization.tsx", import.meta.url),
      ),
    ],
    jsx: "automatic",
    platform: "browser",
    write: false,
  });
  script = result.outputFiles[0]!.text;
});

test("usage at the final initialization handoff reaches the mounted adapter", async ({
  page,
}, testInfo) => {
  await page.goto("about:blank");
  await page.addScriptTag({ content: script });
  const report = await page.evaluate(() => window.runFrameInitialization());
  await testInfo.attach("initialization-state", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  expect(report.sessionStatus).toBe("ready");
  expect(report.usageStatus).toBe("ready");
  expect(report.usageRevision).toBe(1);
  expect(report.appliedStatus).toBe("ready");
  expect(report.updates).toEqual(["ready"]);
  expect(report.error).toBeUndefined();
});
