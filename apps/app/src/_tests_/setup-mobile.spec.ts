import type { Page } from "@playwright/test";

import {
  expect,
  freshEmail,
  open,
  signIn,
  test,
  workspaceAddress,
} from "./harness";
import { atConnectSituation, createWorkspace } from "./setup-walks";

/**
 * The setup screens this plan added, on the narrowest surface the product
 * supports: every control keeps its touch target, and nothing runs past the
 * page.
 */

/** How far the document runs past the viewport, in CSS pixels. */
function overflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

test("the CLI form and the connect situation fit a 320px phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await signIn(page, freshEmail("setup-compact"));
  const workspaceId = await createWorkspace(page, "Setup Compact Org");
  const workspace = await workspaceAddress(page, workspaceId);

  await open(page, `${workspace.path}/-/new/cli`);
  await page
    .getByLabel("Repository", { exact: true })
    .fill("gitlab.com/mokly-ai/web/site");
  await expect(page.getByLabel("Project slug")).toHaveValue("site");
  const create = page.getByTestId("create-cli-project");
  expect((await create.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await overflow(page), "the CLI form").toBeLessThanOrEqual(1);

  await open(page, `/install?installationId=1&workspaceId=${workspaceId}`);
  await atConnectSituation(page, 1);
  const connect = page.getByTestId("connect-installation");
  expect((await connect.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await overflow(page), "the connect situation").toBeLessThanOrEqual(1);
});
