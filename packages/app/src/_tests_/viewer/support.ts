import type { Locator, Page } from "@playwright/test";

import type { ViewerViewport } from "../../viewer/host";
import { projectAddress, publicationPathFor } from "../addresses";
import { expect, freshEmail, signIn } from "../harness";
import { createProject } from "../project-setup";
import { createToken, publish } from "../publish";
import type { PublishInput } from "../publish";
import { makePrivate, setVisibility } from "../visibility";

/** One signed-in reader, their project and one publication of the fixture. */
export interface PublishedProject {
  projectId: string;
  workspaceName: string;
  workspaceSlug: string;
  projectSlug: string;
  projectPath: string;
  publicationId: string;
  publicationPath: string;
  catalogueUrl: string | null;
  token: string;
  /** The address this reader signed in with, which is also their label. */
  email: string;
}

/**
 * Wait until the published package has loaded its stage and the cloud slots
 * that both compositions fill: the centre slot with the publication and the
 * end slot. The compact bar leaves the start slot empty.
 * A transient index read is recovered through the stage card's own Try again
 * once; a repeated failure remains visible and fails the readiness assertion.
 * Tests that start from a settled viewer wait here; tests of loading, access,
 * failure and the slot handoff do not wait on this boundary.
 */
export async function publishedViewerReady(page: Page): Promise<void> {
  const viewer = page.locator(
    ".fo-published-viewer .mokly-viewer[data-mokly-shell]",
  );
  const failed = page
    .locator(".fo-stage-card")
    .filter({ hasText: "This publication couldn’t open" });
  await expect(viewer.or(failed)).toBeVisible();
  if (await failed.isVisible()) {
    await failed.getByRole("button", { name: "Try again" }).click();
  }
  await expect(viewer).toBeVisible();
  await expect(viewer.locator(".mokly-stage-host")).toBeVisible();
  for (const slot of ["topBarCenter", "topBarEnd"]) {
    await expect(
      viewer
        .locator(`[data-mokly-slot="${slot}"] [data-mkc-viewer-slot]`)
        .first(),
    ).toBeVisible();
  }
}

/**
 * The reference that the publication pill draws inside its one control: the
 * branch, or the pull request's number and title, or the compact bar's short
 * form of either. The control's whole text also holds the state and the SHA.
 */
export function publicationReference(scope: Page | Locator): Locator {
  return scope.getByTestId("viewer-publication").locator(".fo-top-reference");
}

/** The full bar's account menu, opened from the reader's avatar. */
export async function openAccountMenu(page: Page): Promise<Locator> {
  await page.getByTestId("viewer-account").click();
  const menu = page.getByRole("menu", { name: "Account" });
  await expect(menu).toBeVisible();
  return menu;
}

/** The settings dialog, opened on its index by the account menu's Settings. */
export async function openSettingsFromAccount(page: Page): Promise<void> {
  const menu = await openAccountMenu(page);
  await menu.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
}

/**
 * The Notice variant reads both consumer lists from its parent's detail, in
 * the Usage section of Inspect. The section starts folded, and a press on its
 * head, `Usage` with its count, unfolds it.
 */
export async function expectParentUsage(page: Page): Promise<void> {
  const usage = page
    .getByRole("tabpanel", { name: "Inspect", exact: true })
    .getByRole("group")
    .filter({ hasText: /^Usage/ });
  await usage.getByText(/^Usage( \d+)?$/).click();
  await expect(usage.getByRole("heading")).toHaveText([
    "Used by",
    "Affected screens and components",
  ]);
  await expect(usage.getByRole("list")).toHaveCount(2);
  for (const list of await usage.getByRole("list").all()) {
    await expect(list.getByRole("link")).toHaveText(["Finish", "Start"]);
    await expect(list.getByRole("listitem")).toHaveText([
      "FinishDirect use · 1 instance · 2 views",
      "StartDirect use · 1 instance · 2 views",
    ]);
  }
}

/**
 * A frame on the canvas, found by the start of its title. The title names the
 * screen or the variant set's row, the viewport and the scheme, such as
 * `Start — mobile — light`: `Start — mobile` finds the screen's Mobile frame
 * in a catalogue without dark views, and `Draft` the frame of a variant set's
 * Draft row.
 */
export function canvasFrame(page: Page, start: string): Locator {
  const literal = start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page.getByTitle(new RegExp(`^${literal} — `));
}

/**
 * Expect the canvas to show a screen in one viewport choice, as the reader
 * sees it: Both shows the screen's Mobile and Desktop frames, and one viewport
 * shows its own frame and not the other's.
 */
export async function expectShownViewport(
  page: Page,
  screen: string,
  viewport: ViewerViewport,
): Promise<void> {
  const sizes = ["mobile", "desktop"] as const;
  const shown = sizes.filter(
    (size) => viewport === "both" || size === viewport,
  );
  for (const size of shown) {
    const frame = `${screen} — ${size}`;
    await expect(canvasFrame(page, frame), frame).toBeVisible();
  }
  for (const size of sizes.filter((size) => !shown.includes(size))) {
    const frame = `${screen} — ${size}`;
    await expect(canvasFrame(page, frame), frame).toBeHidden();
  }
}

/**
 * A viewport toggle of the Frames filter in Inspect, by its name. Its
 * accessible name also holds its frame size, such as `Mobile 390 × 844`.
 */
export function viewportToggle(
  page: Page,
  name: "Desktop" | "Mobile",
): Locator {
  return page
    .getByRole("group", { name: "Frames", exact: true })
    .getByRole("checkbox", { name: new RegExp(`^${name}\\b`) });
}

/**
 * Expect the Frames filter to show a viewport choice: Both turns both
 * viewport toggles on, and one viewport turns its own toggle on and the
 * other's off.
 */
export async function expectViewportToggles(
  page: Page,
  viewport: ViewerViewport,
): Promise<void> {
  for (const [size, name] of [
    ["mobile", "Mobile"],
    ["desktop", "Desktop"],
  ] as const)
    await expect(viewportToggle(page, name), name).toBeChecked({
      checked: viewport === "both" || viewport === size,
    });
}

/**
 * A row of the shown component's variant set in the Variants list of Inspect,
 * by its title: the component's own example, then each saved variant. Each
 * row is a button that selects its frame, and the row whose frame holds the
 * selection is pressed. An address that names a saved variant opens with its
 * frame selected. A dialog makes the page beneath it inert and hides it from
 * assistive technology, so a read beneath one sets `includeHidden`.
 */
export function savedVariant(
  page: Page,
  title: string,
  { includeHidden = false }: { includeHidden?: boolean } = {},
): Locator {
  return page
    .getByRole("region", { name: "Variants", exact: true, includeHidden })
    .getByRole("button", { name: title, exact: true, includeHidden });
}

/**
 * Wait for the route to finish with an address before asserting what it kept.
 *
 * A viewer value the route corrects is corrected only once the publication has
 * resolved, so anything asserted before that describes the address the reader
 * asked for rather than the one the route produced — and a polling matcher
 * takes the first moment that holds, which is that one. Every test whose
 * subject is the settled address waits through this first, and what it waits
 * for is the correction itself: the value the route must remove.
 */
export async function corrected(page: Page, asked: RegExp): Promise<void> {
  await expect(page, "the route corrects what it was given").not.toHaveURL(
    asked,
  );
}

/** Sign a new reader in, create their project, and publish the fixture to it. */
export async function publishedProject(
  page: Page,
  label: string,
  input: PublishInput = { branch: "main" },
): Promise<PublishedProject> {
  const email = freshEmail(label);
  const workspaceName = label + " Org";
  await signIn(page, email);
  const projectId = await createProject(page, workspaceName);
  // Every viewer scenario starts from the private project a Team workspace
  // creates; the ones that read a public publication make it public themselves.
  await makePrivate(page, projectId);
  const token = await createToken(page, projectId);
  const published = await publish(token, projectId, input);
  const address = await projectAddress(page, projectId);
  return {
    projectId,
    workspaceName,
    workspaceSlug: address.workspaceSlug,
    projectSlug: address.slug,
    projectPath: address.path,
    publicationId: published.id,
    publicationPath: await publicationPathFor(page, projectId, published.id),
    catalogueUrl: published.catalogueUrl,
    token,
    email,
  };
}

/**
 * Make one project public through the API the project pane writes with, so a
 * test can read what a public publication actually says rather than describing
 * it.
 */
export async function makePublic(page: Page, projectId: string): Promise<void> {
  await setVisibility(page, projectId, "public");
}

/**
 * Wait for a held request. It fails with the name of the request after the
 * suite's assertion timeout, as a web-first assertion does, rather than
 * holding the test until its own timeout.
 */
export async function arrival(
  arrived: Promise<void>,
  what: string,
): Promise<void> {
  // The `expect.timeout` of `playwright.config.ts`.
  const limit = 15_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${what} did not arrive within ${limit} ms`)),
      limit,
    );
  });
  try {
    await Promise.race([arrived, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hold a successful real read until a test has checked the pending body.
 * `arrived()` settles once the first matching read has answered and is held.
 */
export async function holdViewerRead(
  page: Page,
  matches: (url: URL) => boolean,
): Promise<{ arrived: () => Promise<void>; release: () => void }> {
  const pending = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  await page.route(matches, async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    held.resolve();
    await pending.promise;
    await route.fulfill({ response });
  });
  return {
    arrived: () => arrival(held.promise, "the held viewer read"),
    release: () => pending.resolve(),
  };
}

/** Share offers no link, empty state, or publishing action while it waits. */
export async function expectSharePreparing(panel: Locator): Promise<void> {
  await expect(
    panel.getByText("Preparing the publication link…", { exact: true }),
  ).toBeVisible();
  // The link's field waits in its own frame and holds the read's name where
  // the link would be, and Copy link waits disabled, as Wait in
  // `folio-chrome.md` defines: the panel offers no link to copy.
  await expect(panel.getByLabel("Publication link")).toHaveValue("");
  await expect(panel.getByTestId("share-copy")).toBeDisabled();
  await expect(
    panel.getByText("No publications yet", { exact: true }),
  ).toHaveCount(0);
  await expect(panel.getByTestId("share-set-up-publishing")).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Set up publishing", exact: true }),
  ).toHaveCount(0);
}
