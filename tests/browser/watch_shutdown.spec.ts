import fs from "node:fs/promises";

import { expect } from "@playwright/test";

import { test } from "./watch_fixture.js";

test("watched Serve shutdown closes publication streams and drains its owned fixture", async ({
  page,
  watched,
}) => {
  await page.goto(`${watched.url}/view/fixture/screens/home/`);
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  const events = await fetch(`${watched.url}/mokly-viewer/events`, {
    signal: AbortSignal.timeout(10_000),
  });
  expect(events.status).toBe(200);
  const reader = events.body!.getReader();
  try {
    expect((await reader.read()).done).toBe(false);
    await page.goto("about:blank");
    await watched.close();
    while (!(await reader.read()).done) {
      /* Drain queued publications before EOF. */
    }
    await expect(fs.access(watched.root)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await watched.close();
  } finally {
    await reader.cancel();
  }
});
