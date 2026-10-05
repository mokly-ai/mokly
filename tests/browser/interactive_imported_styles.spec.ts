import {
  expect,
  test,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";

import {
  expectLiveReady,
  expectStatic,
  liveFrame,
  previewMode,
} from "./interactive_shell_helpers.js";

/**
 * Force a full-surface raster even when the page fits the viewport. Compare
 * stable full-page pixels and crop the note from that same raster.
 */
async function captureView(page: Page, note: Locator) {
  await note.locator(".example-workspace-note-mark").evaluate(async (mark) => {
    const background = getComputedStyle(mark).backgroundImage;
    const url = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
    if (!url)
      throw new Error(`Expected the note's background image: ${background}`);
    const image = new Image();
    image.src = url;
    await image.decode();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  let screen: Buffer = Buffer.alloc(0);
  const session = await page.context().newCDPSession(page);
  try {
    await expect
      .poll(
        async () => {
          const { cssContentSize } = await session.send(
            "Page.getLayoutMetrics",
          );
          const { data } = await session.send("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: true,
            clip: { ...cssContentSize, scale: 1 },
          });
          const next = Buffer.from(data, "base64");
          const stable = screen.equals(next);
          screen = next;
          return stable;
        },
        {
          timeout: 5_000,
          intervals: [100],
          message: "Stable full-page pixels",
        },
      )
      .toBe(true);
  } finally {
    await session.detach();
  }
  const clip = await note.boundingBox();
  expect(clip).not.toBeNull();
  const cropPage = await page.context().newPage();
  try {
    const pixels = await cropPage.evaluate(
      async ({ data, clip }) => {
        const response = await fetch(`data:image/png;base64,${data}`);
        const image = await createImageBitmap(await response.blob());
        const left = Math.floor(clip.x);
        const top = Math.floor(clip.y);
        const canvas = new OffscreenCanvas(
          Math.ceil(clip.x + clip.width) - left,
          Math.ceil(clip.y + clip.height) - top,
        );
        canvas.getContext("2d")!.drawImage(image, -left, -top);
        const png = await canvas.convertToBlob({ type: "image/png" });
        return Array.from(new Uint8Array(await png.arrayBuffer()));
      },
      { data: screen.toString("base64"), clip: clip! },
    );
    return { screen, note: Buffer.from(pixels) };
  } finally {
    await cropPage.close();
  }
}

/** Read module, plain CSS and PostCSS effects without the resource's origin. */
async function noteStyles(frame: FrameLocator) {
  return frame
    .getByRole("complementary", { name: "Workspace tip" })
    .evaluate((note) => {
      const style = getComputedStyle(note);
      const title = getComputedStyle(note.querySelector("strong")!);
      const mark = getComputedStyle(
        note.querySelector(".example-workspace-note-mark")!,
      );
      return {
        className: note.className,
        display: style.display,
        gap: style.gap,
        borderRadius: style.borderRadius,
        padding: style.padding,
        color: style.color,
        titleDisplay: title.display,
        titleFontSize: title.fontSize,
        titlePadding: title.padding,
        markWidth: mark.width,
        markImagePath: mark.backgroundImage.replace(/https?:\/\/[^/]+/g, ""),
      };
    });
}

for (const viewport of ["desktop", "mobile"] as const) {
  for (const [_kind, id] of [
    ["component", "example/components/workspace-note"],
    ["screen", "example/screens/welcome"],
  ] as const) {
    test(`${id} keeps imported styles and pixels in ${viewport} Static and Live`, async ({
      page,
      context,
    }, testInfo) => {
      await page.setViewportSize(
        viewport === "desktop"
          ? { width: 1440, height: 1000 }
          : { width: 390, height: 844 },
      );
      await page.goto(`/view/${id}/`);
      await expectStatic(page);
      const frame = page.frameLocator(
        `iframe[data-workspace-frame="${viewport}"]`,
      );
      const note = frame.getByRole("complementary", { name: "Workspace tip" });
      await expect(note).toBeVisible();
      await frame.locator("body").evaluate(() => document.fonts.ready);
      const expected = await noteStyles(frame);
      expect(expected.className).toMatch(/^mokly_[a-f0-9]{12}_note$/);
      expect(expected.display).toBe("flex");
      expect(expected.titleDisplay).toBe("flex");
      expect(expected.titleFontSize).toBe("12px");
      expect(expected.titlePadding).toBe("8px 12px");
      expect(expected.markImagePath).toContain("mokly-generated/assets/");
      const staticUrl = new URL(
        (await page
          .locator(`iframe[data-workspace-frame="${viewport}"]`)
          .getAttribute("src"))!,
        page.url(),
      ).href;

      await previewMode(page).getByRole("button", { name: "Live" }).click();
      await expectLiveReady(page);
      const live = liveFrame(page, viewport);
      await expect(
        live.getByRole("complementary", { name: "Workspace tip" }),
      ).toBeVisible();
      await live.locator("body").evaluate(() => document.fonts.ready);
      await expect.poll(() => noteStyles(live)).toEqual(expected);
      const liveUrl = await live.locator("body").evaluate(() => location.href);
      const screenshots = [];
      for (const url of [staticUrl, liveUrl]) {
        const documentPage = await context.newPage();
        try {
          await documentPage.setViewportSize(page.viewportSize()!);
          await documentPage.goto(url);
          await documentPage.evaluate(() => document.fonts.ready);
          const tip = documentPage.getByRole("complementary", {
            name: "Workspace tip",
          });
          await expect(tip).toBeVisible();
          screenshots.push(await captureView(documentPage, tip));
        } finally {
          await documentPage.close();
        }
      }
      const [staticImage, liveImage] = screenshots;
      const staticNote = staticImage!.note;
      const staticScreen = staticImage!.screen;
      const liveNote = liveImage!.note;
      const liveScreen = liveImage!.screen;
      for (const [name, body] of [
        ["static-note", staticNote],
        ["live-note", liveNote],
        ["static-screen", staticScreen],
        ["live-screen", liveScreen],
      ] as const)
        await testInfo.attach(name, { body, contentType: "image/png" });
      expect(
        liveNote.equals(staticNote),
        "Workspace note screenshot parity",
      ).toBe(true);
      expect(
        liveScreen.equals(staticScreen),
        "Complete view screenshot parity",
      ).toBe(true);
      const links = await live
        .locator("link[rel=stylesheet]")
        .evaluateAll((elements) =>
          elements.map((element) => (element as HTMLLinkElement).href),
        );
      const generated = links.filter((link) =>
        link.includes("/mokly-generated/styles/"),
      );
      expect(generated.length).toBeGreaterThan(0);
      expect(new Set(generated).size).toBe(generated.length);
      for (const link of generated)
        expect((await page.request.get(link)).status(), link).toBe(200);

      await previewMode(page).getByRole("button", { name: "Static" }).click();
      await expectStatic(page);
      await expect.poll(() => noteStyles(frame)).toEqual(expected);
    });
  }
}
