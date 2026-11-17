import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { referenceHistory } from "../fixtures/build-history";
import { sample } from "../fixtures/product";
import { publicationAddress } from "../fixtures/publication-screens";
import {
  branches,
  buildingPullRequest,
  publication,
} from "../fixtures/publications";

import { screenFile } from "./catalogue-paths";

/**
 * The four panels the viewer's slots open over the stage: the switcher, the
 * history, Share and the projects panel, and where each of their rows leads.
 */

/**
 * The query of the link Share copies in each viewport: to Home, the screen the
 * reader is on, and to the whole catalogue of a current-only publication. The
 * address leaves out the desktop viewport and the reader's own scheme. Home
 * has a view in both schemes, so no link needs the light fallback's scheme.
 */
const shareQueries = {
  desktop: { screen: "?catalogueScreen=home", catalogue: "" },
  mobile: {
    screen: "?catalogueScreen=home&viewport=mobile",
    catalogue: "?viewport=mobile",
  },
} as const;

for (const viewport of ["desktop", "mobile"] as const)
  for (const scheme of ["light", "dark"] as const) {
    const url = (screen: string, state?: string) =>
      pathToFileURL(
        screenFile(
          "product/viewer/" + screen + (state ? "/" + state : ""),
          viewport,
          scheme,
        ),
      ).href;
    const label = viewport + " " + scheme;
    const size = {
      width: viewport === "mobile" ? 390 : 1440,
      height: viewport === "mobile" ? 844 : 900,
    };

    test(
      "the switcher groups references by kind: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("switcher"));
        const rows = page.locator(".content-list-row");
        await expect(rows.first()).toContainText(branches[0].name);
        // `listBranches` puts the default branch first, then the other names
        // in bytewise ascending order, and the switcher keeps that order.
        await expect(
          page
            .getByRole("list", { name: "Branches", exact: true })
            .getByRole("listitem"),
        ).toHaveText([
          /^main/,
          /^alex\/bun-migration/,
          /^alex\/onboarding-copy/,
          /^alex\/token-rotation/,
          /^calummoore\/firna-controls/,
          /^calummoore\/protocol-docs/,
          /^calummoore\/sydney-v1/,
        ]);
        for (const reference of branches)
          await expect(
            rows.filter({ hasText: reference.detail }).first(),
          ).toBeVisible();
        // A reference with nothing ready still resolves, so its row opens on
        // the stage that says so; only a failed one leads somewhere else.
        await expect(
          rows.filter({ hasText: "No publication yet" }).getByRole("link", {
            name: "Open",
          }),
        ).toHaveCount(1);
        await expect(
          rows.filter({ hasText: "Unable to publish" }).getByRole("link", {
            name: "Details",
          }),
        ).toHaveCount(2);
        // A row reads its newest build while one publishes, and opening it
        // still resolves the reference: to its ready publication when it has
        // one, otherwise to the build running in its stage.
        const opens = (text: string) =>
          rows
            .filter({ hasText: text })
            .getByRole("link")
            .getAttribute("data-mokly-link");
        await expect(rows.filter({ hasText: "Publishing now" })).toHaveCount(2);
        expect(await opens(publication.branch)).toBe(
          "product/viewer/standalone",
        );
        expect(await opens(buildingPullRequest.title)).toBe(
          "product/viewer/pull-request/publishing",
        );
        expect(await opens("alex/token-rotation")).toBe(
          "product/viewer/standalone/publish",
        );
        // Details opens what failed: a failed publication its own details,
        // and a failed build that build's address, never the reference,
        // whose stage may show another card.
        expect(await opens("calummoore/protocol-docs")).toBe(
          "product/viewer/standalone/failed",
        );
        expect(await opens("alex/bun-migration")).toBe(
          "product/viewer/standalone/build/lockfile",
        );
        // A failed attempt over an earlier ready publication still opens
        // that publication, which beats the old failure's details.
        await expect(
          rows.filter({ hasText: "alex/onboarding-copy" }),
        ).toContainText("Unable to publish");
        expect(await opens("alex/onboarding-copy")).toBe(
          "product/viewer/standalone",
        );
        await page.goto(url("switcher", "empty"));
        await expect(
          page.getByRole("textbox", { name: "Find a branch or pull request" }),
        ).toHaveValue("settings");
        await expect(
          page.getByRole("heading", {
            name: "No branch or pull request matches",
          }),
        ).toBeVisible();
      },
    );

    test(
      "history keeps the current publication in place: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("history"));
        const rows = page.locator(".content-list-row");
        await expect(rows).toHaveCount(referenceHistory.length);
        await expect(
          rows.filter({ hasText: "Current publication" }).getByRole("link"),
        ).toHaveCount(0);
        // Builds sit among the publications and open their own details.
        const details = async (text: string) =>
          rows
            .filter({ hasText: text })
            .getByRole("link", { name: "Details" })
            .evaluateAll((links) =>
              links.map((link) => link.getAttribute("data-mokly-link")),
            );
        expect(await details("Publishing now")).toEqual([
          "product/viewer/standalone/build",
        ]);
        expect((await details("Unable to publish")).sort()).toEqual([
          "product/viewer/standalone/build/failed",
          "product/viewer/standalone/failed",
        ]);
        await expect(
          rows.filter({ hasText: referenceHistory[3].time }).getByRole("link"),
        ).toHaveCount(1);
      },
    );

    test(
      "share offers and links the screens of the document's view: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("share"));
        const link = page.getByRole("textbox", { name: "Publication link" });
        await expect(link).toHaveValue(
          publicationAddress + shareQueries[viewport].screen,
        );
        // Every screen has a light view in both viewports, so under Dark the
        // light-only Pricing and Checkout stay on offer through the light
        // fallback, and Home, the screen the reader is on, stays selected.
        const choices = page
          .getByRole("list", { name: "Screens in this publication" })
          .getByRole("listitem");
        await expect(choices).toHaveCount(5);
        for (const title of [
          "Whole catalogue",
          "Home",
          "Pricing",
          "Checkout",
          "Account",
        ])
          await expect(
            choices.getByText(title, { exact: true }),
            title,
          ).toHaveCount(1);
        // `listScreens` orders screens by current path in bytewise ascending
        // order, and Share offers them in that order after Whole catalogue.
        await expect(choices).toHaveText([
          /^Whole catalogue/,
          /^Account/,
          /^Checkout/,
          /^Home/,
          /^Pricing/,
        ]);
        await expect(choices.filter({ hasText: "Selected" })).toHaveText([
          /^Home/,
        ]);
        await expect(
          choices.getByRole("link", { name: "Select", exact: true }),
        ).toHaveCount(4);
        await expect(
          page.getByText("Project members can open this link."),
        ).toBeVisible();
        await expect(page.getByTestId("firna-button-primary")).toHaveText(
          "Copy link",
        );
        await expect(
          page.getByText(sample.visibility, { exact: true }),
        ).toBeVisible();
        // A current-only publication offers no screen, so its link names the
        // whole catalogue in the same view.
        await page.goto(url("share", "catalogue"));
        await expect(link).toHaveValue(
          publicationAddress + shareQueries[viewport].catalogue,
        );
      },
    );

    test(
      "the projects panel offers every workspace: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("projects"));
        const dialog = page.getByRole("dialog");
        await expect(
          page.getByRole("heading", { level: 1, name: "Projects" }),
        ).toBeVisible();
        await expect(
          dialog.getByText(sample.workspace, { exact: true }).first(),
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Create project" }),
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Workspace settings" }).first(),
        ).toBeVisible();
        await page.getByRole("link", { name: "Close", exact: true }).click();
        await expect(page.locator("[data-mkc-screen]")).toHaveAttribute(
          "data-mkc-screen",
          "product/viewer/standalone",
        );
      },
    );
  }
