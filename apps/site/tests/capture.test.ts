import assert from "node:assert/strict";
import test from "node:test";

import { captureDocument } from "../scripts/capture-document.mjs";

interface FakePage {
  evaluate: () => Promise<number>;
  screenshot: (options: { path: string }) => Promise<Buffer>;
  setViewportSize: (size: { height: number; width: number }) => Promise<void>;
}

function pageThat(records: {
  screenshots: { path: string }[];
  viewports: { height: number; width: number }[];
}): FakePage {
  return {
    evaluate: async () => 4_398,
    screenshot: async (options) => {
      records.screenshots.push(options);
      return Buffer.alloc(0);
    },
    setViewportSize: async (size) => {
      records.viewports.push(size);
    },
  };
}

test("document captures use a tall viewport so sandboxed frames are painted", async () => {
  const records = { screenshots: [], viewports: [] } as {
    screenshots: { path: string }[];
    viewports: { height: number; width: number }[];
  };

  await captureDocument(pageThat(records), 390, "home.png");

  assert.deepEqual(records.viewports, [
    { height: 4_398, width: 390 },
    { height: 900, width: 390 },
  ]);
  assert.deepEqual(records.screenshots, [{ path: "home.png" }]);
});

test("document captures restore the inspection viewport after a failure", async () => {
  const records = { screenshots: [], viewports: [] } as {
    screenshots: { path: string }[];
    viewports: { height: number; width: number }[];
  };
  const page = pageThat(records);
  page.screenshot = async () => {
    throw new Error("capture failed");
  };

  await assert.rejects(captureDocument(page, 320, "home.png"), /failed/);
  assert.deepEqual(records.viewports, [
    { height: 4_398, width: 320 },
    { height: 900, width: 320 },
  ]);
});
