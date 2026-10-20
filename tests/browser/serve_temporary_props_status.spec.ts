/**
 * Temporary props in Serve under the component controls contract: a
 * component that is unchanged against the base commit stays Unmodified while
 * a temporary edit shows, after Reset, and on an unchanged saved variant. The
 * edit reaches no URL, Changes count, source, Git status, or publication.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { git } from "../helpers/static_changes.js";

import { showProps } from "./live_props.js";
import { test } from "./serve_comparison_test.js";
import { chooseVariant } from "./workspace_actions.js";

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: temporary props and Reset keep an unchanged component Unmodified`, async ({
    page,
    changes,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
    );
    const source = path.join(
      changes.root,
      "specs/components/tag.component.html",
    );
    const saved = await fs.readFile(source, "utf8");
    const status = page.locator("[data-workspace-status]");
    const count = page.locator(
      'button[data-filter="changed"] .mbk-nav-filter-count',
    );
    await page.goto(`/view/${changes.paths.quietParent}/?viewport=${viewport}`);
    await expect(status).toHaveText("Unmodified");
    const changed = (await count.textContent())!;
    const address = page.url();
    const { revision } = await changes.index();
    const tree = await git(changes.root, "status", "--porcelain");
    const props = await showProps(page);
    if (viewport === "mobile")
      await page.getByRole("button", { name: "Expand inspector" }).click();
    const label = props.getByRole("textbox", { name: "label" });
    const tag = page
      .frameLocator(`[data-workspace-frame="${viewport}"]`)
      .locator(".tag");
    await expect(label).toBeEditable();
    await expect(tag).toHaveText("Tag content");

    await label.fill("Temporary tag");
    await expect(tag).toHaveText("Temporary tag");
    await expect(status).toHaveText("Unmodified");
    await expect(count).toHaveText(changed);
    await expect(page).toHaveURL(address);

    await props.getByRole("button", { name: "Reset to Tag" }).click();
    await expect(tag).toHaveText("Tag content");
    await expect(label).toHaveValue("Tag content");
    await expect(status).toHaveText("Unmodified");

    await chooseVariant(page, "Plain");
    await expect(tag).toHaveText("Plain tag");
    await expect(status).toHaveText("Unmodified");
    await expect(count).toHaveText(changed);
    expect(await fs.readFile(source, "utf8")).toBe(saved);
    expect(await git(changes.root, "status", "--porcelain")).toBe(tree);
    expect((await changes.index()).revision).toBe(revision);
  });
