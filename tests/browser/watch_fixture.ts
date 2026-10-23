import fs from "node:fs/promises";
import path from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

import type { CatalogueNode, CatalogueReadModel } from "@mokly/viewer";

import { ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";

import { test as browserTest } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";
import { readDisclosureStorage } from "./disclosure_storage.js";
import { closeServe, replaceFile, settleLive } from "./live_shell_fixture.js";

export const watchedScreen = (title: string, body = `<h1>${title}</h1>`) =>
  `---\ntitle: ${title}\n---\n${body}`;

/** Each test owns a native catalogue and a watched process, with no shared edits. */
async function watchedCatalogue() {
  const host = await serveCatalogue(
    {
      "specs/fixture/_folder.json": '{"title":"Fixture"}',
      "specs/fixture/screens/_folder.json": '{"title":"Screens"}',
      "specs/fixture/screens/home.screen.html": watchedScreen(
        "Home",
        '<h1 data-watch-version="1">Original home</h1><a href="mock:./details">Details</a>',
      ),
      "specs/fixture/screens/details.screen.html": watchedScreen("Details"),
      "specs/fixture/screens/states/_folder.json": '{"title":"States"}',
      "specs/fixture/screens/states/home.screen.html":
        watchedScreen("State home"),
      "specs/fixture/screens/states/details.screen.html":
        watchedScreen("State details"),
      "specs/fixture/archive/_folder.json": '{"title":"Archive"}',
      "specs/fixture/archive/home.screen.html": watchedScreen("Archive home"),
      "specs/fixture/archive/states/_folder.json":
        '{"title":"Archived states"}',
      "specs/fixture/archive/states/home.screen.html":
        watchedScreen("Archived state"),
      "specs/fixture/other.screen.html": watchedScreen("Other"),
    },
    { colorSchemes: ["light", "dark"], watch: { debounceMs: 0 } },
    { watch: true },
  );
  try {
    await settleLive(host.url);
  } catch (error) {
    await host.close();
    throw error;
  }
  const index = async () =>
    (await (
      await fetch(`${host.url}/mokly-viewer/index.json`)
    ).json()) as CatalogueReadModel;
  return {
    ...host,
    index,
    write: (file: string, contents: string) =>
      replaceFile(host.root, file, contents),
    move: (from: string, to: string) =>
      fs.rename(path.join(host.root, from), path.join(host.root, to)),
    async change(
      edit: () => Promise<void>,
      accept: (value: CatalogueReadModel) => boolean,
    ) {
      const before = await index();
      await edit();
      await settleLive(host.url, before.revision, accept);
      const after = await index();
      expect(after.revision).toBeGreaterThan(before.revision);
      expect(after.deploymentId).toBe(before.deploymentId);
      expect(accept(after)).toBe(true);
      return { before, after };
    },
  };
}

export const test = browserTest.extend<{
  watched: Awaited<ReturnType<typeof watchedCatalogue>>;
}>({
  watched: [
    async ({ page }, use) => {
      const watched = await watchedCatalogue();
      try {
        await use(watched);
      } finally {
        await closeServe(page, watched);
      }
    },
    { timeout: ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS },
  ],
});

export const folder = (page: Page, name: string) =>
  page.locator(
    `[data-nav-section="specs"] [data-nav-folder="folder:fixture/${name}"]`,
  );

/** Wait for the click's DOM state and its saved choice when storage is enabled. */
export async function toggleFolder(group: Locator) {
  const open = (await group.getAttribute("open")) !== null;
  const unfiltered = (await group.getAttribute("data-filter-open")) === null;
  const key = await group.getAttribute("data-nav-disclosure");
  if (!key) throw new Error("The watched folder has no disclosure key");
  const saved = (value: boolean) =>
    expect
      .poll(() => readDisclosureStorage(group.page()))
      .toMatchObject({ [key]: value });
  if (unfiltered) await saved(open);
  await group.locator(":scope > summary").click();
  if (open) await expect(group).not.toHaveAttribute("open", "");
  else await expect(group).toHaveAttribute("open", "");
  if (unfiltered) await saved(!open);
}

export function screenKeys(index: CatalogueReadModel, name: string) {
  const screen = index.screens.find(
    (entry) => entry.path === `fixture/${name}`,
  );
  return screen?.views.map((view) => view.documentKey);
}

export function folderTitle(
  index: CatalogueReadModel,
  name: string,
): string | undefined {
  const find = (nodes: readonly CatalogueNode[]): string | undefined => {
    for (const node of nodes) {
      if (node.kind === "folder" && node.path === `fixture/${name}`)
        return node.title;
      const title = node.children ? find(node.children) : undefined;
      if (title !== undefined) return title;
    }
    return undefined;
  };
  return find(index.tree);
}

/** A document mark distinguishes a retained preview from a replacement at the same URL. */
export function markDocument(frame: Locator) {
  return frame.evaluate((element: HTMLIFrameElement) => {
    element.contentDocument!.documentElement.dataset["watchDocument"] =
      "retained";
  });
}

export function documentMark(frame: Locator) {
  return frame.evaluate(
    (element: HTMLIFrameElement) =>
      element.contentDocument?.documentElement.dataset["watchDocument"],
  );
}
