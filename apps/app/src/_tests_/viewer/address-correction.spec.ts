import { expect, open, test } from "../harness";
import { corrected, publishedViewerReady, publishedProject } from "./support";

/**
 * Addresses the pinned viewer cannot take as they are. Each is corrected
 * before the package mounts, so the reader lands on the catalogue the rest of
 * the address names rather than on the package's unavailable view, which
 * replaces the whole viewer, the cloud's own controls included.
 */
test("an earlier variant address keeps its component and drops the key", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(
    page,
    "retired-variant",
  );
  await open(page, `${path}?catalogueScreen=notice&variantId=draft`);
  await corrected(page, /variantId=/);
  // Only the catalogue knows which entry an old variant name became, so the
  // route keeps the component and the package shows the component's own
  // page, the first row of its variant bar.
  expect(new URL(page.url()).search).toBe("?catalogueScreen=notice");
  await publishedViewerReady(page);
  await expect(
    page.getByRole("heading", { level: 2, name: "Notice" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy path notice", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-workspace-variant="notice"]'),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.locator('[data-workspace-variant="notice/draft"]'),
  ).not.toHaveAttribute("aria-current", "page");
});

test("a snapshot the package would refuse is corrected before it mounts", async ({
  page,
}) => {
  const { publicationPath: path } = await publishedProject(
    page,
    "snapshot-shape",
  );
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
