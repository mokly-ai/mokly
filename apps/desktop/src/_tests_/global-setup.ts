import { readFileSync, rmSync } from "node:fs";
import { expect } from "@playwright/test";
import { startApi, startCatalogue } from "../../../app/src/_tests_/api-server";
import {
  startGitHubDouble,
  stopGitHubDouble,
} from "../../../app/src/_tests_/github-double";
import { DESKTOP_ORIGIN } from "../origin.js";
import {
  expectShellSettings,
  launch,
  profileDirectory,
  screenshot,
} from "./shell";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { devDependencies: { electron: string } };

/** Open offline first, then prepare the app harness before its worker reads the schema URL. */
export default async function setup(): Promise<void> {
  const profile = profileDirectory("offline-profile");
  const electron = await launch(profile);
  try {
    const versions = await electron.evaluate(() => process.versions);
    expect(versions.electron).toBe(packageJson.devDependencies.electron);
    expect(versions.chrome?.split(".")[0]).toBe("152");
    const page = await electron.firstWindow();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(page.url()).toBe(DESKTOP_ORIGIN + "/dashboard");
    await screenshot(page, "offline-launch");
    await expectShellSettings(electron);
  } finally {
    await electron.close();
    rmSync(profile, { recursive: true, force: true });
  }
  // The proof creates a project, and a project is a repository the App can
  // read, so the API runs against the recorded GitHub the app suite uses.
  const github = await startGitHubDouble();
  if (github.failure) throw new Error(github.failure);
  const api = await startApi({ github: true });
  if (api.failure || api.skip) {
    stopGitHubDouble();
    throw new Error(api.failure ?? api.skip);
  }
  const catalogue = await startCatalogue();
  if (catalogue.failure) throw new Error(catalogue.failure);
}
