import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { exportCatalogue } from "../../dist/export/run.js";
import { serve } from "../../dist/server/serve.js";
import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";
import { waitForClassifiedCount } from "../helpers/watched_catalogue.js";

let fixture: Awaited<ReturnType<typeof createFixture>>;
let live: Awaited<ReturnType<typeof serve>>;
let staticSite: Awaited<ReturnType<typeof serveStaticFiles>>;
let imageSize = 0;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  fixture = await createFixture(`import React from "react";
import { defineScreen } from "@mokly/mokly";
import classes from "./theme.module.css";
export const mockups = [defineScreen({
  id: "home", title: "Home", description: "Imported CSS comparison",
  dependencies: [], relatedDocs: [], navPath: ["Fixture"],
  mobile: <main><button className={classes.auth}>Sign in</button></main>,
  desktop: <main><button className={classes.auth}>Sign in</button></main>
})];`);
  const source = path.join(fixture.entriesDir, "theme.module.css");
  const image = await fs.readFile(
    path.join(
      repositoryRoot,
      "examples/basic/src/components/workspace-note/signal.png",
    ),
  );
  imageSize = image.length;
  await fs.writeFile(path.join(fixture.entriesDir, "mark.png"), image);
  const css = (color: string) =>
    `.auth { color: ${color}; background-image: url("./mark.png"); }`;
  await fs.writeFile(source, css("rgb(10, 20, 30)"));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  git("add", ".");
  git("commit", "-qm", "test: styled baseline");
  await fs.writeFile(source, css("rgb(30, 20, 10)"));
  await writeCompilation(await compileCatalogue(config), config);
  live = await serve(config, { base: "main", port: 0, watch: false });
  fixture.beforeRemove(() => live.close());
  await waitForClassifiedCount(live.url, 1);
  await exportCatalogue(config, { outDir: "site", base: "main" });
  staticSite = await serveStaticFiles(path.join(fixture.root, "site"));
  fixture.beforeRemove(() => staticSite.close());
});

test.afterAll(async () => {
  if (fixture) await removeFixture(fixture);
});

async function expectStyledPanes(page: Page): Promise<void> {
  for (const [side, color] of [
    ["before", "rgb(10, 20, 30)"],
    ["after", "rgb(30, 20, 10)"],
  ] as const) {
    const frame = page
      .locator(
        `[data-mokly-comparison-frame][data-mokly-preview-source*="/snapshots/${side}/"]`,
      )
      .first();
    await expect(frame).toHaveAttribute("srcdoc", /\S/u);
    const button = frame
      .contentFrame()
      .getByRole("button", { name: "Sign in" });
    await expect(button).toHaveCSS("color", color);
    const bytes = await button.evaluate(async (element) => {
      const value = getComputedStyle(element).backgroundImage;
      const image = /^url\(["']?(.*?)["']?\)$/u.exec(value)?.[1];
      if (!image) return -1;
      const response = await fetch(image);
      return response.ok ? (await response.arrayBuffer()).byteLength : -1;
    });
    expect(bytes).toBe(imageSize);
  }
}

for (const [host, address] of [
  ["Serve", () => `${live.url}/view/screens/home.html`],
  ["static export", () => `${staticSite.url}/view/screens/home.html`],
] as const)
  test(`${host} comparison panes retain CSS Modules and url assets`, async ({
    page,
  }) => {
    await page.goto(address());
    await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
    await page.getByRole("button", { name: "Overlay", exact: true }).click();
    await expectStyledPanes(page);
    for (const mode of ["Difference", "Side by side"] as const) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      await expectStyledPanes(page);
    }
  });
