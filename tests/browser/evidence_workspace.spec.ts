import { expect, test } from "@playwright/test";

import type { ReviewResultV3 } from "../../packages/viewer/dist/review/component_types.js";
import { controlsEntrySource } from "../helpers/component_controls_fixture.js";
import { startEvidenceFixture } from "../helpers/evidence_fixture.js";

import { expectFrameLoaded } from "./workspace_actions.js";

test("Usage and Changes completion preserve edited props and their live preview", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture(controlsEntrySource());
  const { server, runtime, compilation } = fixture;
  try {
    await page.goto(`${server.url}/view/components/action.html`);
    await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    await expect(page.locator('[data-inspector-panel="usage"]')).toContainText(
      "until the catalogue has been checked",
    );
    await page.getByRole("tab", { name: "Props", exact: true }).click();
    const label = page.getByLabel("Label", { exact: true });
    const frame = page.frameLocator('[data-workspace-frame="desktop"]');
    await label.fill("Keep this edit");
    await expect(
      frame.getByRole("button", { name: "Keep this edit" }),
    ).toBeVisible();
    await frame
      .locator("body")
      .evaluate((body) => body.setAttribute("data-test-retained", "true"));
    await page
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-retained", "true"));
    expect(
      server.completeCatalogue?.(compilation.manifest, runtime.generation),
    ).toBe(true);
    server.publishUpdate({ kind: "evidence" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-update-version",
      "2",
    );
    await expect(label).toHaveValue("Keep this edit");
    await expect(label).toBeFocused();
    await expect(frame.locator("body")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
    await expect(page.locator('[data-inspector-panel="usage"]')).toContainText(
      "Home",
    );
    await expect(
      page.locator('[data-inspector-panel="usage"]'),
    ).not.toContainText("until the catalogue has been checked");
    server.publishUpdate({
      kind: "evidence",
      componentChanges: { baseline: compilation.manifest, changedRoutes: [] },
      changedRoutes: [],
      changesStatus: "ready",
    });
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    await expect(label).toBeFocused();
    await expect(label).toHaveValue("Keep this edit");
    await expect(frame.locator("body")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
    await label.fill("Still editable");
    await expect(
      frame.getByRole("button", { name: "Still editable" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(frame.getByRole("button", { name: "Continue" })).toBeVisible();
    await page
      .getByLabel("Saved variant", { exact: true })
      .selectOption("disabled");
    await expect(
      frame.getByRole("button", { name: "Continue" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await expect(
      frame.getByRole("button", { name: "Continue" }),
    ).toHaveAttribute("data-scheme", "dark");
    await expect(page.locator("[data-workspace-highlight]")).toHaveAttribute(
      "title",
      "No registered components are used in this view.",
    );
    const demandUsage = page.waitForResponse(
      (response) =>
        response.url().includes("/__mokly/views/screens/home.") &&
        response.ok(),
    );
    await page.locator('a[data-route="screens/home.html"]').click();
    await demandUsage;
    await expect(page.locator("[data-workspace-highlight]")).toBeEnabled();
    await page.locator("[data-workspace-highlight]").click();
    await expect(page.locator("[data-workspace-highlight]")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(fixture.comparisonRequests).toBe(0);
  } finally {
    await fixture.close();
  }
});

test("Changes completion preserves keyboard focus on an unchanged Usage link", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture(controlsEntrySource());
  const { server, runtime, compilation } = fixture;
  try {
    await page.goto(`${server.url}/view/components/action.html`);
    expect(
      server.completeCatalogue?.(compilation.manifest, runtime.generation),
    ).toBe(true);
    server.publishUpdate({ kind: "evidence" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-update-version",
      "2",
    );
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    const usage = page.getByRole("tabpanel", {
      name: "Usage",
      exact: true,
    });
    const home = usage.getByRole("link", { name: "Home", exact: true }).first();
    await home.focus();
    await expect(home).toBeFocused();
    const retained = await home.elementHandle();

    server.publishUpdate({
      kind: "evidence",
      componentChanges: {
        baseline: compilation.manifest,
        result: affectedUsageResult(),
      },
      changedRoutes: [],
      changesStatus: "ready",
    });

    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-update-version",
      "3",
    );
    await expect(usage).toContainText("Affected screens and components");
    await expect(home).toBeFocused();
    expect(await retained!.evaluate((link) => link.isConnected)).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/screens\/home\.html/);
    await expectFrameLoaded(
      page.locator('[data-workspace-frame="mobile"]'),
      /\/screens\/home\.mobile\.html/,
    );
  } finally {
    await fixture.close();
  }
});

function affectedUsageResult(): ReviewResultV3 {
  return {
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: ["entries/fixture.mockup.tsx"],
    ignoredImpact: [],
    schemaVersion: 3,
    sharedImpact: [],
    screens: [],
    components: [],
    changes: [
      {
        kind: "component",
        after: {
          id: "action",
          route: "components/action.html",
          title: "Action",
        },
        reasons: [{ kind: "material" }],
      },
    ],
    affectedConsumers: [
      {
        changedComponentId: "action",
        consumer: { kind: "screen", route: "screens/home.html" },
        evidence: [
          {
            side: "after",
            context: {
              kind: "screen",
              entry: {
                id: "home",
                route: "screens/home.html",
                title: "Home",
              },
              viewport: "mobile",
              colorScheme: "light",
            },
            via: [{ componentId: "action", instanceKey: "affected-action" }],
          },
        ],
      },
    ],
  };
}
