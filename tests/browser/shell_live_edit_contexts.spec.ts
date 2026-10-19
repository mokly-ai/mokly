/**
 * Live prop edits across their contexts in Serve, under the component
 * controls contract and its design: a value outside a number field's bounds,
 * a viewport switch, an expired temporary preview, and a scheme change while
 * the first render is pending.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { test } from "./browser_test.js";
import { openProps, renders } from "./live_props.js";
import {
  cardFile,
  closeServe,
  renderBody,
  serveLiveCatalogue,
} from "./live_shell_fixture.js";
import { endedRequests, passRenderingUpdates } from "./page_settling.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

/** The URL and text of one viewport's stage frame, read through the page. */
function frameDocument(page: Page, viewport: "desktop" | "mobile") {
  return page
    .locator(`#mb-main iframe[data-workspace-frame="${viewport}"]`)
    .evaluate((frame: HTMLIFrameElement) => ({
      url: frame.contentDocument?.URL ?? "",
      text: frame.contentDocument?.body?.innerText ?? "",
    }));
}

const text = async (page: Page, viewport: "desktop" | "mobile") =>
  (await frameDocument(page, viewport)).text;

/** The temporary preview of the card's desktop view in one scheme. */
const preview = (scheme: string) =>
  new RegExp(
    `/mokly-viewer/components/renders/[^/]+/static/mokly-generated/card/index\\.desktop${scheme}\\.html$`,
    "u",
  );

test("a number outside its bounds marks the field and keeps the last valid preview", async ({
  page,
}) => {
  const server = await serveLiveCatalogue({
    files: {
      "specs/card.component.html": cardFile().replace(
        "count: {type: number}",
        "count: {type: integer, minimum: 0, maximum: 24}",
      ),
    },
  });
  try {
    const props = await openProps(page, server.url, {
      query: "?viewport=desktop",
    });
    const sent = renders(page);
    const count = props.locator('[data-prop-control="count"]');
    await expect(count).toHaveAccessibleDescription("0–24");
    await count.fill("30");
    await expect(count).toHaveAttribute("aria-invalid", "true");
    await expect(count).toHaveAccessibleDescription(
      "Enter a number from 0 to 24.",
    );
    await expect(props.getByRole("alert")).toHaveText(
      "Check the highlighted values. The preview shows the last valid props.",
    );
    // A boolean edit renders at once, but not while another value is invalid.
    await props.locator('[data-prop-control="active"]').check();
    await count.fill("2.5");
    await expect(count).toHaveAccessibleDescription(
      "Enter a whole number from 0 to 24.",
    );
    await expect.poll(() => text(page, "desktop")).toMatch(/^Hello 1\s*$/u);

    await count.fill("7");
    await expect(count).not.toHaveAttribute("aria-invalid");
    await expect(count).toHaveAccessibleDescription("0–24");
    await expect(props.getByRole("alert")).toHaveCount(0);
    await expect.poll(() => text(page, "desktop")).toMatch(/^Hello 7Active/u);
    // Every render that the edits sent carried only valid values.
    expect(sent.length).toBeGreaterThan(0);
    for (const request of sent)
      expect(request.postDataJSON().overrides).toEqual({
        active: { kind: "set", value: true },
        count: { kind: "set", value: 7 },
      });
  } finally {
    await closeServe(page, server);
  }
});

test("a viewport switch keeps the edit and shows it in each frame that it shows", async ({
  page,
}) => {
  const server = await serveLiveCatalogue();
  try {
    const props = await openProps(page, server.url, {
      query: "?viewport=desktop",
    });
    const sent = renders(page);
    const label = props.getByRole("textbox", { name: "label" });
    await label.fill("Switched");
    await expect.poll(() => text(page, "desktop")).toContain("Switched 1");

    await chooseViewport(page, "mobile");
    await expect.poll(() => text(page, "mobile")).toContain("Switched 1");
    await expect(label).toHaveValue("Switched");
    await chooseViewport(page, "both");
    for (const viewport of ["mobile", "desktop"] as const)
      await expect.poll(() => text(page, viewport)).toContain("Switched 1");
    expect(
      new Set(sent.map((request) => renderBody(request).viewport)),
    ).toEqual(new Set(["desktop", "mobile"]));
    expect(new Set(sent.map((request) => renderBody(request).label))).toEqual(
      new Set(["Switched"]),
    );
  } finally {
    await closeServe(page, server);
  }
});

test("an expired preview keeps the edit and shows the saved props, and Update preview renders it again", async ({
  page,
  allowBrowserError,
}) => {
  // The expiry check of the first preview is answered as Serve answers an
  // evicted render id.
  allowBrowserError({
    kind: "console",
    message:
      /^Failed to load resource: the server responded with a status of 410 \(Gone\)$/u,
    url: preview(""),
  });
  const server = await serveLiveCatalogue();
  try {
    const props = await openProps(page, server.url, {
      query: "?viewport=desktop",
    });
    let checks = 0;
    await page.route("**/mokly-viewer/components/renders/**", (route) => {
      if (route.request().method() !== "HEAD") return route.continue();
      checks += 1;
      return checks === 1 ? route.fulfill({ status: 410 }) : route.continue();
    });
    const label = props.getByRole("textbox", { name: "label" });
    await label.fill("Retained edit");
    await expect(
      props.getByText("The preview of your edits expired"),
    ).toBeVisible();
    await expect(
      props.getByText(
        "Your edits are kept. The preview shows the saved props.",
      ),
    ).toBeVisible();
    await expect(label).toHaveValue("Retained edit");
    await expect.poll(() => text(page, "desktop")).toMatch(/^Hello 1\s*$/u);

    await props.getByRole("button", { name: "Update preview" }).click();
    await expect.poll(() => text(page, "desktop")).toContain("Retained edit 1");
    await expect(
      props.getByText("The preview of your edits expired"),
    ).toHaveCount(0);
    await expect(
      props.getByRole("heading", { name: "Edit props" }),
    ).toBeFocused();
    // The new preview passed its own expiry check.
    expect(checks).toBeGreaterThan(1);
  } finally {
    await closeServe(page, server);
  }
});

test("a scheme change while the first render is pending shows only the new scheme's preview", async ({
  page,
}) => {
  const server = await serveLiveCatalogue({
    config: { colorSchemes: ["light", "dark"] },
  });
  try {
    const props = await openProps(page, server.url, {
      query: "?viewport=desktop",
    });
    const held: Route[] = [];
    await page.route("**/mokly-viewer/components/render", (route) => {
      if (route.request().postDataJSON().colorScheme === "light")
        held.push(route);
      else return route.continue();
    });
    const ended = endedRequests(page);
    await props.getByRole("textbox", { name: "label" }).fill("Context edit");
    await expect.poll(() => held.length).toBe(1);

    await chooseScheme(page, "dark");
    const dark = {
      url: expect.stringMatching(preview("\\.dark")),
      text: expect.stringContaining("Context edit 1"),
    };
    await expect.poll(() => frameDocument(page, "desktop")).toEqual(dark);
    // Release the light render, wait until the browser ends it, then let the
    // shell handle it.
    await Promise.all(
      held.map((route) => route.continue().catch(() => undefined)),
    );
    await expect
      .poll(() => held.every((route) => ended.has(route.request())))
      .toBe(true);
    // The shell cancelled the light render when the scheme changed.
    for (const route of held)
      expect(route.request().failure()?.errorText).toBe("net::ERR_ABORTED");
    await passRenderingUpdates(page);
    expect(await frameDocument(page, "desktop")).toEqual(dark);
  } finally {
    await closeServe(page, server);
  }
});
