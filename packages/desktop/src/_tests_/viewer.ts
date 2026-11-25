import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { publicationPathFor } from "../../../app/src/_tests_/addresses";
import { expectTakesClicksThroughout } from "../../../app/src/_tests_/mac-window/regions";
import { createProject } from "../../../app/src/_tests_/project-setup";
import { createToken, publish } from "../../../app/src/_tests_/publish";
import { makePrivate } from "../../../app/src/_tests_/visibility";
import { DESKTOP_ORIGIN } from "../origin.js";

import { screenshot } from "./shell";

/** Prove the current package limit, separately from CORS and framing admission. */
export async function viewerProof(page: Page): Promise<string> {
  const project = await createProject(page, "Desktop Org", DESKTOP_ORIGIN);
  await makePrivate(page, project);
  const publication = await publish(await createToken(page, project), project, {
    branch: "main",
    currentOnly: true,
  });
  const origin = publication.catalogueUrl!;
  const path = await publicationPathFor(page, project, publication.id);
  const catalogue = page.waitForResponse(origin + "/mokly-viewer/index.json");
  await page.goto(DESKTOP_ORIGIN + path + "?catalogueScreen=start");
  const response = await catalogue;
  expect(response.status()).toBe(200);
  expect((await response.request().allHeaders()).origin).toBe(DESKTOP_ORIGIN);
  expect(response.headers()["access-control-allow-origin"]).toBe(
    DESKTOP_ORIGIN,
  );
  await expect(page.getByTestId("viewer-project")).toBeVisible();
  await expect(page.getByTestId("viewer-share")).toBeVisible();
  // The avatar lies over the account Button. This Chromium passes the bar's
  // drag region down to it, so the Mac window must not move on any press there.
  await expectTakesClicksThroughout(
    page,
    page.getByTestId("viewer-account"),
    "the account control",
  );
  // This assertion must change after the upstream pin bump fixes desktop hosts.
  // The failed line also offers Try again, so it is found by its role.
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "This preview could not be loaded." })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.locator('iframe[data-mokly-frame-state="error"]:visible').first(),
  ).toBeVisible();
  await screenshot(page, "viewer-current-limit");

  const documentUrl =
    origin + "/static/mokly-generated/start/index.desktop.html";
  const admitted = page.waitForResponse(documentUrl);
  await page.evaluate((url) => {
    const frame = document.createElement("iframe");
    frame.id = "admitted-catalogue";
    frame.src = url;
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    document.body.append(frame);
  }, documentUrl);
  const documentResponse = await admitted;
  expect(documentResponse.status()).toBe(200);
  expect(documentResponse.headers()["content-security-policy"]).toContain(
    DESKTOP_ORIGIN,
  );
  const documentBody = await documentResponse.body();
  await expect(
    page
      .frameLocator("#admitted-catalogue")
      .getByRole("heading", { name: "Publish the draft" }),
  ).toBeVisible();
  // Keep all real catalogue bytes; remove only the admission under test.
  const denied = documentUrl + "?denied=1";
  await page.route(denied, async (route) => {
    await route.fulfill({
      status: documentResponse.status(),
      body: documentBody,
      headers: {
        ...documentResponse.headers(),
        "content-security-policy": "frame-ancestors 'self'",
      },
    });
  });
  const failed = page.waitForEvent("requestfailed", {
    predicate: (request) => request.url() === denied,
  });
  await page.evaluate((url) => {
    const frame = document.createElement("iframe");
    frame.id = "denied-catalogue";
    frame.src = url;
    document.body.append(frame);
  }, denied);
  expect((await failed).failure()?.errorText).toContain("BLOCKED");
  return path;
}
