import { resolve } from "node:path";

import type { Page } from "@playwright/test";
import { buildSync } from "esbuild";

import { expect, test } from "../harness";
import { repositoryRoot } from "../root";

const [probe] = buildSync({
  entryPoints: [
    resolve(repositoryRoot, "apps/app/src/_tests_/data/resource-probe.tsx"),
  ],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  define: { "process.env.NODE_ENV": '"development"' },
  tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
}).outputFiles;

async function openProbe(page: Page): Promise<void> {
  await page.setContent('<div id="resource-probe"></div>');
  await page.addScriptTag({ content: probe.text });
  await expect(page.getByLabel("Resource status")).toHaveText("loading");
  await expect(page.getByLabel("Requests", { exact: true })).toHaveText("one");
  await page.getByRole("button", { name: "Resolve read" }).click();
  await expect(page.getByLabel("Resource value")).toHaveText("one");
}

test("useResource hides another key in the first commit before effects", async ({
  page,
}) => {
  await openProbe(page);
  await page.getByRole("button", { name: "Switch key" }).click();
  await expect(page.getByLabel("Committed frames")).toContainText("two:");
  const frames = await page.getByLabel("Committed frames").textContent();
  expect(frames?.split("\n").find((frame) => frame.startsWith("two:"))).toBe(
    "two:loading",
  );
  await page.getByRole("button", { name: "Resolve read" }).click();
  await expect(page.getByLabel("Resource value")).toHaveText("two");
});

test("immutable reuse still permits explicit reload and invalidation", async ({
  page,
}) => {
  await openProbe(page);
  await page.getByRole("button", { name: "Reuse settled state" }).click();
  await page.getByRole("button", { name: "Toggle enabled" }).click();
  await expect(page.getByLabel("Effects committed")).toHaveText(
    "one:false:true",
  );
  await page.getByRole("button", { name: "Toggle enabled" }).click();
  await expect(page.getByLabel("Effects committed")).toHaveText(
    "one:true:true",
  );
  await expect(page.getByLabel("Requests", { exact: true })).toHaveText("one");
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await expect(page.getByLabel("Resource status")).toHaveText(
    "ready refreshing",
  );
  await expect(page.getByLabel("Resource value")).toHaveText("one");
  await expect(page.getByLabel("Requests", { exact: true })).toHaveText(
    "one,one",
  );
  await page.getByRole("button", { name: "Resolve read" }).click();
  await expect(page.getByLabel("Resource status")).toHaveText("ready");
  await page.getByRole("button", { name: "Invalidate" }).click();
  await expect(page.getByLabel("Resource status")).toHaveText(
    "ready refreshing",
  );
  await expect(page.getByLabel("Requests", { exact: true })).toHaveText(
    "one,one,one",
  );
});

test("normal resources retain their value while re-enable refreshes", async ({
  page,
}) => {
  await openProbe(page);
  await page.getByRole("button", { name: "Toggle enabled" }).click();
  await page.getByRole("button", { name: "Toggle enabled" }).click();
  await expect(page.getByLabel("Resource status")).toHaveText(
    "ready refreshing",
  );
  await expect(page.getByLabel("Resource value")).toHaveText("one");
  await expect(page.getByLabel("Requests", { exact: true })).toHaveText(
    "one,one",
  );
});

test("immutable reuse reads the first key again after an unfinished key change", async ({
  page,
}) => {
  await openProbe(page);
  await page.getByRole("button", { name: "Reuse settled state" }).click();
  await page.getByRole("button", { name: "Switch key" }).click();
  await expect(page.getByLabel("Requests", { exact: true })).toHaveText(
    "one,two",
  );
  await page.getByRole("button", { name: "Return to first key" }).click();
  await expect(page.getByLabel("Requests", { exact: true })).toHaveText(
    "one,two,one",
  );
  await page.getByRole("button", { name: "Resolve read" }).click();
  await expect(page.getByLabel("Resource status")).toHaveText("loading");
  await expect(page.getByLabel("Resource value")).toHaveText("");
  await page.getByRole("button", { name: "Resolve read" }).click();
  await expect(page.getByLabel("Resource value")).toHaveText("one");
});

test("a disabled resource keeps manual values only for their key", async ({
  page,
}) => {
  await openProbe(page);
  await page.getByRole("button", { name: "Toggle enabled" }).click();
  await page.getByRole("button", { name: "Set disabled state" }).click();
  await expect(page.getByLabel("Resource value")).toHaveText("manual");
  await page.getByRole("button", { name: "Switch key" }).click();
  await expect(page.getByLabel("Resource status")).toHaveText("loading");
  await expect(page.getByLabel("Resource value")).toHaveText("");
  await expect(page.getByLabel("Requests", { exact: true })).toHaveText("one");
  await page.getByRole("button", { name: "Reuse settled state" }).click();
  await page.getByRole("button", { name: "Set disabled state" }).click();
  await expect(page.getByLabel("Resource value")).toHaveText("manual");
  await page.getByRole("button", { name: "Return to first key" }).click();
  await page.getByRole("button", { name: "Toggle enabled" }).click();
  await expect(page.getByLabel("Requests", { exact: true })).toHaveText(
    "one,one",
  );
  await page.getByRole("button", { name: "Resolve read" }).click();
  await expect(page.getByLabel("Resource value")).toHaveText("one");
});

test("a failed same-key refresh exposes the typed error", async ({ page }) => {
  await openProbe(page);
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await expect(page.getByLabel("Resource status")).toHaveText(
    "ready refreshing",
  );
  await page.getByRole("button", { name: "Fail read" }).click();
  await expect(page.getByLabel("Resource status")).toHaveText("error");
  await expect(page.getByLabel("Resource error")).toHaveText(
    "operation-unavailable",
  );
});
