/**
 * Live props of a design library component on the example Serve host, under
 * the component controls contract and its design: an optional prop is unset
 * and set, a nested component that an edit shows brings its styles, Reset
 * restores the saved variant, and no edit writes a source file.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";
import { canvasFrame, revealInPanel } from "./workspace_actions.js";

const SOURCE = path.join(
  repositoryRoot,
  "examples/basic/specs/design/library/chrome/top-bar.tsx",
);

/** The edited saved variant, whose row of the variant set shows the edit. */
const VARIANT = "design/library/chrome/top-bar/search";

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: design props are temporary, unset and set an optional prop, and load the styles of a newly shown nested component`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
    );
    const source = await fs.readFile(SOURCE, "utf8");
    await page.goto(`/view/${VARIANT}/?viewport=${viewport}`);
    // In the compact layout the inspector stands in the panel's sheet, whose
    // grabber expands it.
    const tab = page.getByRole("tab", { name: "Props", exact: true });
    await revealInPanel(page, tab);
    await tab.click();
    if (viewport === "mobile")
      await page.getByRole("button", { name: "Expand panel" }).click();
    const props = page.getByRole("tabpanel", { name: "Props", exact: true });
    // The edited variant's row shows the edit in its Light and Dark frames;
    // the compact layout shows the routed variant's Light frame.
    const frameOf = (scheme: "dark" | "light") =>
      page.frameLocator(
        `${canvasFrame("desktop", scheme)}[data-workspace-variant="${VARIANT}"]`,
      );
    const frame = frameOf("light");
    const search = frame.getByRole("searchbox", { name: "Search catalogue" });
    const query = props.locator('[data-prop-control="query"]');
    await expect(query).toBeEditable();
    await expect(search).toHaveValue("tag:forms");

    await query.fill("New search");
    await expect(search).toHaveValue("New search");
    await expect(
      frameOf("dark").getByRole("searchbox", {
        name: "Search catalogue",
        includeHidden: true,
      }),
    ).toHaveValue("New search");
    // The tag picker renders tag chips that the saved variant does not show;
    // the preview brings their styles with them.
    await props.locator('[data-prop-control="pickerOpen"]').check();
    await expect(frame.locator(".mbk-tag-picker")).toBeVisible();
    await expect(frame.locator(".mbk-chip").first()).toHaveCSS(
      "cursor",
      "pointer",
    );
    const supplied = props.getByRole("checkbox", { name: "Set Query" });
    await supplied.uncheck();
    await expect(query).toBeHidden();
    await expect(search).toHaveValue("");
    await expect(frame.locator(".mbk-tag-picker")).toBeVisible();
    await supplied.check();
    await expect(query).toHaveValue("New search");
    await expect(search).toHaveValue("New search");

    await props.getByRole("button", { name: "Reset to Search" }).click();
    await expect(frame.locator(".mbk-tag-picker")).toHaveCount(0);
    await expect(search).toHaveValue("tag:forms");
    await expect(query).toHaveValue("tag:forms");
    expect(await fs.readFile(SOURCE, "utf8")).toBe(source);
  });
