import { expect, open, test } from "../harness";

import { makePublic, publishedProject, publishedViewerReady } from "./support";

/*
 * Focus across the bar's own widths. The bar changes its composition at the
 * switch width and History's drawing at the label width, while a control's
 * trigger keeps the focus it holds and a dismissed overlay returns focus to
 * the control that carries its action now.
 */

test("focus stays with the pill and History, and returns to the pill, as the bar changes", async ({
  page,
}) => {
  const made = await publishedProject(page, "viewer-bar-focus");
  await makePublic(page, made.projectId);
  await open(page, made.publicationPath);
  await publishedViewerReady(page);

  await test.step("a dismissed switcher returns focus to the pill wherever the composition puts it", async () => {
    const viewer = page.locator("[data-mokly-shell]");
    const publication = viewer.getByTestId("viewer-publication");
    const panel = page.getByTestId("viewer-panel-switcher");
    const container = page.locator('[data-mkc-screen="viewer"]');
    // The modal hides its backdrop from accessibility. Include the rendered
    // control only to wait for the new composition before dismissal.
    const rendered = (name: string) =>
      viewer.getByRole("button", { name, exact: true, includeHidden: true });

    // A change of composition while the switcher is open keeps the pill's
    // trigger, which both bars hold in the centre slot.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(viewer.getByTestId("viewer-history")).toBeVisible();
    await publication.click();
    await expect(panel).toBeVisible();
    await container.evaluate((element) => {
      element.style.width = "768px";
    });
    await expect(rendered("More")).toBeVisible();
    await page.getByTestId("close-switcher").click();
    await expect(panel).toHaveCount(0);
    await expect(
      publication,
      "the switcher opened from the full bar returns to the compact bar's pill",
    ).toBeFocused();

    await publication.click();
    await expect(panel).toBeVisible();
    await container.evaluate((element) =>
      element.style.removeProperty("width"),
    );
    await expect(rendered("History")).toBeVisible();
    await page.getByTestId("close-switcher").click();
    await expect(panel).toHaveCount(0);
    await expect(
      publication,
      "the switcher opened from the compact bar returns to the full bar's pill",
    ).toBeFocused();
  });

  await test.step("the pill and History keep the focus they hold as the bar changes its drawings", async () => {
    const viewer = page.locator("[data-mokly-shell]");
    const publication = viewer.getByTestId("viewer-publication");
    const history = viewer.getByTestId("viewer-history");
    const container = page.locator('[data-mkc-screen="viewer"]');
    const narrow = (width?: string) =>
      container.evaluate((element, value) => {
        if (value) element.style.width = value;
        else element.style.removeProperty("width");
      }, width);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(history).toHaveText("History");

    // The pill stays in the centre slot on both bars, so its trigger stays.
    await publication.focus();
    await narrow("768px");
    await expect(viewer.getByTestId("viewer-more")).toBeVisible();
    await expect(
      publication,
      "the pill keeps focus on the compact bar",
    ).toBeFocused();
    await narrow();
    await expect(history).toBeVisible();
    await expect(
      publication,
      "the pill keeps focus on the full bar",
    ).toBeFocused();

    // History draws its glyph alone on a narrower full bar, as the same control.
    await history.focus();
    await narrow("1100px");
    await expect(history).toHaveText("");
    await expect(history).toHaveAccessibleName("History");
    await expect(
      history,
      "History keeps focus as it drops its label",
    ).toBeFocused();
    await narrow();
    await expect(history).toHaveText("History");
    await expect(
      history,
      "History keeps focus as it draws its label",
    ).toBeFocused();
  });
});
