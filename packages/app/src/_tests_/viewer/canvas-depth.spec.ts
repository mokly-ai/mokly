import type { Locator } from "@playwright/test";

import { projectPathFor } from "../addresses";
import { expect, freshEmail, open, signIn, test } from "../harness";
import { createProject } from "../project-setup";

/**
 * The layers of the two Canvas shadows in the light scheme, as the Floating
 * and Overlay roles of `design-tokens.md` give them: each layer's offsets,
 * blur and spread, which the browser writes after the layer's colour.
 */
const floatShadow = /0px 1px 1px 0px.*0px 4px 10px -2px.*0px 18px 36px -14px/;
const deepShadow = /0px 1px 1px 0px.*0px 10px 20px -6px.*0px 40px 80px -28px/;

/** A surface over the canvas: the 12px floating radius and the deep shadow. */
async function expectOverlayDepth(surface: Locator): Promise<void> {
  await expect(surface).toHaveCSS("border-radius", "12px");
  await expect(surface).toHaveCSS("box-shadow", deepShadow);
}

/**
 * The cloud's own surfaces in the Canvas depth of `folio-viewer.md`: a
 * non-ready stage is the dot-grid canvas with its one card floating on it,
 * and a panel and the settings dialog float over the stage in the deep
 * shadow.
 */
test("the stage card floats on the dot grid and panels float deep over it", async ({
  page,
}) => {
  await signIn(page, freshEmail("canvas-depth"));
  const projectId = await createProject(page, "Depth Org");
  const path = await projectPathFor(page, projectId);

  await open(page, path);
  await expect(
    page.getByRole("heading", { name: "No publications yet" }),
  ).toBeVisible();
  const canvas = page.locator(".fo-stage-canvas");
  await expect(canvas).toHaveCSS("background-image", /radial-gradient/);
  await expect(canvas).toHaveCSS("background-size", "24px 24px");
  const card = page.locator(".fo-stage-card .fo-state");
  await expect(card).toHaveCSS("border-radius", "12px");
  await expect(card).toHaveCSS("box-shadow", floatShadow);

  await open(page, path + "?panel=switcher");
  await expectOverlayDepth(
    page.getByTestId("viewer-panel-switcher").getByRole("dialog"),
  );

  await open(page, path + "?settings=account");
  await expectOverlayDepth(
    page.getByTestId("settings-dialog").getByRole("dialog"),
  );
});
