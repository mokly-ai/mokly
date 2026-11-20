import { resolve } from "node:path";

import { buildSync } from "esbuild";

import { fixtureDesktopOrigin } from "../desktop-fixture";
import { expect, test } from "../harness";
import { apiOrigin, appOrigin } from "../origins";
import { repositoryRoot } from "../root";

const [probe] = buildSync({
  entryPoints: [
    resolve(repositoryRoot, "packages/app/src/_tests_/session/focus-probe.tsx"),
  ],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  define: {
    "process.env.NODE_ENV": '"development"',
    "process.env.EXPO_PUBLIC_MKC_API_ORIGIN": JSON.stringify(apiOrigin),
    "process.env.EXPO_PUBLIC_MKC_APP_ORIGIN": JSON.stringify(appOrigin),
    // Chromium cannot serve Electron's scheme. Keep the real focus listener
    // and give its location check the protocol of the shared desktop fixture.
    "window.location.protocol": JSON.stringify(
      new URL(fixtureDesktopOrigin).protocol,
    ),
  },
  tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
}).outputFiles;

test("desktop window focus keeps the newest session on screen", async ({
  page,
}) => {
  await page.setContent('<div id="session-probe"></div>');
  await page.addScriptTag({ content: probe.text });
  await expect(page.getByLabel("Session reads")).toHaveText("1");
  await page.getByRole("button", { name: "Answer startup" }).click();
  await expect(page.getByLabel("Completed read")).toHaveText("1");
  await expect(page.getByLabel("GitHub connection")).toHaveText(
    "not connected",
  );

  await page.getByRole("button", { name: "Focus window" }).click();
  await page.getByRole("button", { name: "Focus window" }).click();
  await expect(page.getByLabel("Session reads")).toHaveText("3");
  await expect(page.getByLabel("Unanswered reads")).toHaveText("2,3");
  await page.getByRole("button", { name: "Answer newer focus" }).click();
  await expect(page.getByLabel("Completed read")).toHaveText("3");
  await expect(page.getByLabel("Unanswered reads")).toHaveText("2");
  await expect(page.getByLabel("GitHub connection")).toHaveText("connected");
  await expect(page.getByLabel("CSRF token")).toHaveText("new-csrf");

  await page.getByRole("button", { name: "Answer older focus" }).click();
  await expect(page.getByLabel("Completed read")).toHaveText("2");
  await expect(page.getByLabel("Unanswered reads")).toHaveText("");
  await expect(page.getByLabel("GitHub connection")).toHaveText("connected");
  await expect(page.getByLabel("CSRF token")).toHaveText("new-csrf");
});
