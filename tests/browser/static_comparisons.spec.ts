import { expect } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { staticRequests } from "./static_delivery_assertions.js";
import { chooseScheme } from "./workspace_actions.js";

for (const viewport of ["mobile", "desktop", "both"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    for (const [mode, label] of [
      ["side", "Side by side"],
      ["overlay", "Overlay"],
      ["difference", "Difference"],
    ] as const) {
      test(`${viewport}/${scheme}: a copied native comparison presents ${label}`, async ({
        page,
        request,
        baseURL,
      }) => {
        const index = await (
          await request.get(`${baseURL}/mokly-viewer/index.json`)
        ).json();
        expect(index.changesStatus).toBe("ready");
        expect(index.comparisonUrl).toMatch(
          /^mokly-viewer\/diffs\/generations\/[a-f0-9]{64}\/review\.json$/,
        );
        expect(index).not.toHaveProperty("live");
        const requests = staticRequests(page);
        await page.goto(
          `/view/${comparisonPaths.changed}/?viewport=${viewport}`,
        );
        await expect(page.locator("#mb-main h2").first()).toHaveText(
          "Changed screen",
        );
        await chooseScheme(page, scheme);
        await page.getByRole("button", { name: label, exact: true }).click();
        const viewports =
          viewport === "both" ? ["mobile", "desktop"] : [viewport];
        await expect(
          page.locator("iframe[data-mokly-comparison-frame]"),
        ).toHaveCount(viewports.length * 2);
        for (const paneViewport of viewports) {
          const panes = page.locator(
            `[data-diff-viewport="${paneViewport}"] [data-compare-mode]`,
          );
          await expect(panes).toHaveAttribute("data-compare-mode", mode);
          const frames = panes.locator("iframe[data-mokly-comparison-frame]");
          await expect(frames).toHaveCount(2);
          const generation = new URL(index.comparisonUrl, baseURL).href.replace(
            /review\.json$/,
            "",
          );
          const file = `index.${paneViewport}${scheme === "dark" ? ".dark" : ""}.html`;
          for (const [side, title, text] of [
            ["before", "Before", "Before screen"],
            ["after", "Current", "After screen"],
          ] as const) {
            const frame = panes.locator(
              `iframe[title="${title} — ${paneViewport} — ${scheme}"]`,
            );
            await expect(frame).toHaveAttribute(
              "data-mokly-preview-source",
              `${generation}snapshots/${side}/mokly-generated/${comparisonPaths.changed}/${file}`,
            );
            await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
            await expect(frame).not.toHaveAttribute("src");
            await expect(
              frame
                .contentFrame()
                .getByRole("heading", { name: text, exact: true }),
            ).toBeVisible();
          }
          await expect(
            panes.locator(".browser-frame, .phone-frame"),
          ).toHaveCount(mode === "side" ? 2 : 1);
          if (mode === "overlay")
            await expect(panes.locator(".mb-pane--after")).toHaveCSS(
              "opacity",
              "0.5",
            );
          if (mode === "difference")
            await expect(panes.locator(".mb-pane--after")).toHaveCSS(
              "mix-blend-mode",
              "difference",
            );
        }
        await expect(
          page.getByRole("button", { name: label, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        requests.assert();
      });
    }
  }
}

test("a copied comparison reload keeps its non-null generation URL and loads the same snapshots", async ({
  page,
  request,
  baseURL,
}) => {
  const indexUrl = `${baseURL}/mokly-viewer/index.json`;
  const before = await (await request.get(indexUrl)).json();
  expect(before.comparisonUrl).not.toBeNull();
  const requests = staticRequests(page);
  await page.goto(
    `/view/${comparisonPaths.changed}/?viewport=desktop&comparison=side`,
  );
  await expect(
    page.locator(
      '[data-compare-mode="side"] iframe[data-mokly-comparison-frame]',
    ),
  ).toHaveCount(2);
  const source = await page
    .locator("iframe[data-mokly-comparison-frame]")
    .evaluateAll((frames) =>
      frames.map((frame) => frame.getAttribute("data-mokly-preview-source")),
    );
  await page.reload();
  await expect(
    page.locator(
      '[data-compare-mode="side"] iframe[data-mokly-comparison-frame]',
    ),
  ).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator("iframe[data-mokly-comparison-frame]")
        .evaluateAll((frames) =>
          frames.map((frame) =>
            frame.getAttribute("data-mokly-preview-source"),
          ),
        ),
    )
    .toEqual(source);
  const after = await (await request.get(indexUrl)).json();
  expect(after.comparisonUrl).toBe(before.comparisonUrl);
  expect(after.deploymentId).toBe(before.deploymentId);
  expect(
    requests.urls.filter(
      (url) => url === new URL(before.comparisonUrl, baseURL).href,
    ),
  ).toHaveLength(2);
  requests.assert();
});
