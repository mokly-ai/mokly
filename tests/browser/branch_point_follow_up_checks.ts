/** Rendered checks for lookup contract cases 6 to 8 in each host. */

import { expect, type Page } from "@playwright/test";

import type { BranchHost, BranchHostKind } from "./branch_hosts.js";
import {
  expectHead,
  expectRouted,
  inspectorTab,
  openChanges,
  openEntry,
  variantBar,
} from "./branch_point_ui.js";

/** Removed-screen inspection retains component titles, props and link targets. */
export async function removedScreenUsage(
  page: Page,
  host: BranchHost,
  kind: BranchHostKind,
): Promise<void> {
  const model = await (
    await page.request.get(`${host.url}/__mokly/catalogue.json`)
  ).json();
  expect(
    model.removedEntries.map(
      (record: { entry: { title: string } }) => record.entry.title,
    ),
  ).toEqual(["Case receipt", "Receipt"]);
  for (const [screen, screenTitle, title, id, parent] of [
    ["shop/receipt", "Receipt", "Badge", "badge", "library/ui/badge"],
    ["shop/case-receipt", "Case receipt", "Pill", "Pill", "library/pill"],
  ] as const) {
    await openEntry(page, host, screen);
    await expectHead(page, screenTitle, ["Shop [text]"]);
    await inspectorTab(page, "Components");
    const instance = page.getByRole("button", {
      name: `${title} · ${id}`,
      exact: true,
    });
    await expect(instance).toBeVisible();
    await instance.click();
    await inspectorTab(page, "Props");
    await expect(
      page.getByRole("heading", { name: `${title} · ${id}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("table[aria-label='Supplied props'] pre"),
    ).toHaveText('"Paid"');
    const link = page.getByRole("link", {
      name: "Open component",
      exact: true,
    });
    await expect(link).toHaveAttribute("href", `/view/${parent}/`);
    await link.click();
    await expectRouted(page, kind, parent);
    await expect(page.locator(".mbk-screen-head h2")).toHaveText(title);
    if (kind === "viewer") {
      await inspectorTab(page, "Usage");
      const usage = page.locator("[data-usage-section='used-by'] a");
      await expect(usage).toHaveText(`${screenTitle} · Removed`);
      await expect(usage).toHaveAttribute(
        "href",
        new RegExp(`^/view/${screen}/\\?`),
      );
      await usage.click();
      await expectRouted(page, kind, screen);
      await inspectorTab(page, "Components");
      await page
        .getByRole("button", { name: `${title} · ${id}`, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: `${title} · ${id}`, exact: true }),
      ).toBeVisible();
    }
  }
}

/** Published order, navigation rows and variant bars keep baseline sibling order. */
export async function removedVariantOrder(
  page: Page,
  host: BranchHost,
  kind: BranchHostKind,
): Promise<void> {
  const model = await (
    await page.request.get(`${host.url}/__mokly/catalogue.json`)
  ).json();
  expect(
    model.removedEntries.map(
      (record: { entry: { path: string }; parentTitle: string }) => [
        record.entry.path,
        record.parentTitle,
      ],
    ),
  ).toEqual([
    ["library/action/zulu", "Action"],
    ["library/action/alpha", "Action"],
    ["library/Choice/zulu", "Choice"],
    ["library/Choice/alpha", "Choice"],
  ]);
  for (const [parent, previous, title] of [
    ["library/archive/action", "library/action", "Action"],
    ["library/choice", "library/Choice", "Choice"],
  ] as const) {
    await openEntry(page, host, `${parent}/default`);
    await expect(page.locator(".mbk-screen-head h2")).toHaveText(title);
    await expect
      .poll(() => variantBar(page))
      .toEqual([
        `default -> ${parent}/default (current)`,
        `zulu · Removed -> ${previous}/zulu`,
        `alpha · Removed -> ${previous}/alpha`,
      ]);
    const nav = await openChanges(page);
    const list = nav.locator(`[data-nav-disclosure="variants:${parent}"]`);
    await expect(list).toBeVisible();
    const rows = list.locator("a[data-entry-id]:visible");
    await expect(rows).toContainText(
      parent === "library/archive/action"
        ? ["default · Moved", "zulu · Removed", "alpha · Removed"]
        : ["zulu · Removed", "alpha · Removed"],
    );
    await expect
      .poll(() =>
        rows.evaluateAll((links) =>
          links.map((link) => link.getAttribute("data-entry-id")),
        ),
      )
      .toEqual(
        parent === "library/archive/action"
          ? [`${parent}/default`, `${previous}/zulu`, `${previous}/alpha`]
          : [`${previous}/zulu`, `${previous}/alpha`],
      );
    await rows.filter({ hasText: "zulu" }).click();
    await expectRouted(page, kind, `${previous}/zulu`);
    await expectHead(page, title, [
      "Library [text]",
      `${title} -> /view/${parent}/`,
    ]);
    await expect
      .poll(() => variantBar(page))
      .toEqual([
        `default -> ${parent}/default`,
        `zulu · Removed -> ${previous}/zulu (current)`,
        `alpha · Removed -> ${previous}/alpha`,
      ]);
  }
}

/** A new parent does not hide the moved variant's nested Before/Current values. */
export async function newParentVariant(
  page: Page,
  host: BranchHost,
  kind: BranchHostKind,
): Promise<void> {
  await openEntry(page, host, "library/receiver/primary");
  await expectHead(page, "Receiver", [
    "Library [button]",
    "Receiver -> /view/library/receiver/",
  ]);
  await expect
    .poll(() => variantBar(page))
    .toEqual(["primary -> library/receiver/primary (current)"]);
  if (kind !== "serve") {
    await inspectorTab(page, "Nested components");
    await expect(
      page.getByRole("button", { name: "Badge · badge", exact: true }),
    ).toBeVisible();
  }
  await inspectorTab(page, "Details");
  const evidence = page.locator("[data-workspace-evidence]");
  if (kind === "viewer") {
    await expect(
      evidence.getByRole("heading", { name: /^Badge · badge ·/ }),
    ).toHaveCount(0);
    return;
  }
  for (const viewport of ["mobile", "desktop"]) {
    const heading = evidence.getByRole("heading", {
      name: `Badge · badge · ${viewport} · light`,
      exact: true,
    });
    await expect(heading).toBeVisible();
    await expect(heading.locator("xpath=following-sibling::p[1]")).toHaveText(
      "Before",
    );
    await expect(heading.locator("xpath=following-sibling::pre[1]")).toHaveText(
      '{"label": "Continue"}',
    );
    await expect(heading.locator("xpath=following-sibling::p[2]")).toHaveText(
      "Current",
    );
    await expect(heading.locator("xpath=following-sibling::pre[2]")).toHaveText(
      '{"label": "Submit"}',
    );
  }
  await expect(evidence).toContainText("Supplied props or slots changed.");
}
