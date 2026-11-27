import { expect, open, test } from "../harness";

import { corrected, publishedViewerReady, publishedProject } from "./support";

/**
 * Addresses the pinned viewer cannot take as they are. Each is corrected
 * before the package mounts, so the reader lands on the catalogue the rest of
 * the address names rather than on the package's unavailable view, which
 * replaces the whole viewer, the cloud's own controls included.
 */
test("an address the pinned viewer cannot take is corrected before the package mounts", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(
    page,
    "address-correction",
  );

  await test.step("an earlier variant address keeps its component and drops the key", async () => {
    await open(page, `${path}?catalogueScreen=notice&variantId=draft`);
    await corrected(page, /variantId=/);
    // Only the catalogue knows which entry an old variant name became, so the
    // route keeps the component and the package shows the component's own
    // page, which the catalogue marks as the current page.
    expect(new URL(page.url()).search).toBe("?catalogueScreen=notice");
    await publishedViewerReady(page);
    await expect(
      page.getByRole("heading", { level: 2, name: "Notice" }),
    ).toBeVisible();
    // The head of the canvas section names the entry's path.
    await expect(
      page.getByRole("button", { name: "Copy path notice", exact: true }),
    ).toBeVisible();
    const catalogue = page.getByRole("navigation", { name: "Catalogue" });
    await expect(
      catalogue.getByRole("link", { name: /^Notice( Changed)?$/ }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      catalogue.getByRole("link", { name: /^Draft( Changed)?$/ }),
    ).not.toHaveAttribute("aria-current", "page");
  });

  await test.step("a snapshot the package would refuse is corrected before it mounts", async () => {
    // Uppercase is not the identity grammar the package accepts.
    await open(
      page,
      `${path}?catalogueScreen=start&catalogueSnapshot=${"A".repeat(64)}`,
    );
    await corrected(page, /catalogueSnapshot=/);
    expect(new URL(page.url()).search).toBe("?catalogueScreen=start");
    await publishedViewerReady(page);
    await expect(
      page.getByRole("heading", { level: 2, name: "Start" }),
    ).toBeVisible();
    await expect(
      page.getByText("The requested view is unavailable."),
    ).toHaveCount(0);
  });
});
