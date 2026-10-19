/**
 * Live prop edits across their contexts in Serve, under the component
 * controls contract and its design: a viewport and scheme switch, an expired
 * temporary preview, and a scheme change while the first render is pending.
 */

import { expect, type Route } from "@playwright/test";

import { test } from "./browser_test.js";
import { frameDocument, frameText, openProps, renders } from "./live_props.js";
import {
  closeServe,
  renderBody,
  serveLiveCatalogue,
} from "./live_shell_fixture.js";
import { endedRequests, passRenderingUpdates } from "./page_settling.js";
import { chooseScheme, chooseViewport } from "./workspace_actions.js";

/** The temporary preview of one view of the card. */
const preview = (viewport: "desktop" | "mobile", scheme: string) =>
  new RegExp(
    `/mokly-viewer/components/renders/[^/]+/static/mokly-generated/card/index\\.${viewport}${scheme}\\.html$`,
    "u",
  );

test("a viewport switch keeps the edit and shows it in each frame that it shows", async ({
  page,
}) => {
  const server = await serveLiveCatalogue({
    config: { colorSchemes: ["light", "dark"] },
  });
  try {
    const props = await openProps(page, server.url, {
      query: "?viewport=desktop",
    });
    const sent = renders(page);
    const label = props.getByRole("textbox", { name: "label" });
    await label.fill("Switched");
    await expect.poll(() => frameText(page, "desktop")).toContain("Switched 1");

    await chooseViewport(page, "mobile");
    await expect.poll(() => frameText(page, "mobile")).toContain("Switched 1");
    await expect(label).toHaveValue("Switched");
    await chooseViewport(page, "both");
    for (const viewport of ["mobile", "desktop"] as const)
      await expect
        .poll(() => frameText(page, viewport))
        .toContain("Switched 1");
    // Dark renders the kept edit in both frames.
    await chooseScheme(page, "dark");
    for (const viewport of ["mobile", "desktop"] as const)
      await expect
        .poll(() => frameDocument(page, viewport))
        .toEqual({
          url: expect.stringMatching(preview(viewport, "\\.dark")),
          text: expect.stringContaining("Switched 1"),
        });
    const sentBodies = sent.map((request) => request.postDataJSON());
    expect(new Set(sentBodies.map((body) => body.viewport))).toEqual(
      new Set(["desktop", "mobile"]),
    );
    expect(new Set(sentBodies.map((body) => body.colorScheme))).toEqual(
      new Set(["light", "dark"]),
    );
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
    url: preview("desktop", ""),
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
    await expect
      .poll(() => frameText(page, "desktop"))
      .toMatch(/^Hello 1\s*$/u);

    await props.getByRole("button", { name: "Update preview" }).click();
    await expect
      .poll(() => frameText(page, "desktop"))
      .toContain("Retained edit 1");
    await expect(
      props.getByText("The preview of your edits expired"),
    ).toHaveCount(0);
    await expect(
      props.getByRole("heading", { name: "Edit props" }),
    ).toBeFocused();
    // The panel still marks the props as edited.
    await expect(
      props.getByText("Edited props", { exact: true }),
    ).toBeVisible();
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
      url: expect.stringMatching(preview("desktop", "\\.dark")),
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
