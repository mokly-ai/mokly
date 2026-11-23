/**
 * Live prop edits across their contexts in Serve, under the component
 * controls contract and its design: on the canvas and in the compact layout
 * both schemes of an edited row through a viewport and scheme switch; below
 * the layout breakpoint a scheme change while the first render is pending;
 * and an expired temporary preview.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { test } from "./browser_test.js";
import { frameDocument, frameText, openProps, renders } from "./live_props.js";
import {
  closeServe,
  renderBody,
  serveLiveCatalogue,
} from "./live_shell_fixture.js";
import { endedRequests, passRenderingUpdates } from "./page_settling.js";
import {
  chooseScheme,
  chooseViewport,
  NARROW_WINDOW,
} from "./workspace_actions.js";

/** The temporary preview of one view of the card. */
const preview = (viewport: "desktop" | "mobile", scheme: string) =>
  new RegExp(
    `/mokly-viewer/components/renders/[^/]+/static/mokly-generated/card/index\\.${viewport}${scheme}\\.html$`,
    "u",
  );

/**
 * Edit the card's label, then expect the edit in the Light and Dark frames
 * of its row, one render for each, which the viewport and scheme choices
 * keep without another render.
 */
async function expectRowEdit(page: Page, text: string, query = "") {
  const server = await serveLiveCatalogue({
    config: { colorSchemes: ["light", "dark"] },
  });
  try {
    const props = await openProps(page, server.url, { query });
    const sent = renders(page);
    const label = props.getByRole("textbox", { name: "label" });
    await label.fill(text);
    const shown = (scheme: "dark" | "light") => ({
      url: expect.stringMatching(
        preview("desktop", scheme === "dark" ? "\\.dark" : ""),
      ),
      text: expect.stringContaining(`${text} 1`),
    });
    for (const scheme of ["light", "dark"] as const)
      await expect
        .poll(() => frameDocument(page, "desktop", scheme))
        .toEqual(shown(scheme));
    const contexts = () =>
      sent
        .map((request) => request.postDataJSON())
        .map((body) => `${body.viewport}/${body.colorScheme}`);
    expect(contexts().sort()).toEqual(["desktop/dark", "desktop/light"]);
    // A component's frames show its desktop views whatever the choices, so
    // they keep the edit without another render.
    await chooseViewport(page, "mobile");
    await chooseScheme(page, "dark");
    for (const scheme of ["light", "dark"] as const)
      await expect
        .poll(() => frameDocument(page, "desktop", scheme))
        .toEqual(shown(scheme));
    await passRenderingUpdates(page);
    expect(contexts()).toHaveLength(2);
    expect(new Set(sent.map((request) => renderBody(request).label))).toEqual(
      new Set([text]),
    );
    await expect(label).toHaveValue(text);
  } finally {
    await closeServe(page, server);
  }
}

test("on the canvas, an edit renders the Light and Dark frames of its row, and the viewport and scheme choices keep them", async ({
  page,
}) => {
  await expectRowEdit(page, "Both schemes");
});

test("below the layout breakpoint, a viewport switch keeps the edit and shows it in each frame that it shows", async ({
  page,
}) => {
  // The compact layout shows the card's whole set as the canvas does: its
  // desktop views, Light beside Dark, whatever the viewport choice.
  await page.setViewportSize(NARROW_WINDOW);
  await expectRowEdit(page, "Switched", "?viewport=desktop");
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

test("below the layout breakpoint, a scheme change while the first render is pending shows only the new scheme's preview", async ({
  page,
}) => {
  // The one-frame stage renders the chosen scheme alone; the canvas renders
  // both schemes of an edited row at once.
  await page.setViewportSize(NARROW_WINDOW);
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
