import type { Request } from "@playwright/test";

import { branchPathFor } from "./addresses";
import { currentWorkspaceId, expect, signIn, test } from "./harness";
import { shareSelection, uniqueSlug } from "./readable-addresses-support";
import {
  settingsLink,
  expectExactReturnTo,
  expectSettingsHandoff,
  endSession,
  reopenSignInWindow,
  retireAddressSlugs,
} from "./settings-address-handoff";
import {
  canvasFrame,
  publicationReference,
  publishedProject,
  savedVariant,
} from "./viewer/support";

test("a signed-out retired settings link redirects without reading scope", async ({
  page,
}) => {
  const privateReads: string[] = [];
  const remember = (request: Request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname.startsWith("/v1/workspaces") ||
      pathname.startsWith("/v1/projects")
    ) {
      privateReads.push(pathname);
    }
  };
  page.on("request", remember);
  const destination = settingsLink(
    "/retired-team/retired-project/settings/access",
    "start",
  );

  await page.goto(destination);
  await page.waitForURL((url) => url.pathname === "/sign-in");
  expectExactReturnTo(page.url(), destination);
  await expect(page.getByLabel("Email")).toBeVisible();
  page.off("request", remember);
  expect(privateReads).toEqual([]);
});

test("private settings keep an exact branch and viewer query through email sign-in", async ({
  page,
}) => {
  const branch = "review&docs+plus#notes/équipe-東京";
  const made = await publishedProject(page, "uuid-settings-handoff", {
    branch,
  });
  const selection = await shareSelection(
    page,
    made.projectId,
    made.publicationId,
  );
  const panes = [
    ["", "project", "Project"],
    ["/tokens", "tokens", "Publishing tokens"],
    ["/access", "access", "Access"],
    ["/danger", "danger", "Delete project"],
  ] as const;
  for (const [tail, pane, title] of panes) {
    await page.goto(
      settingsLink(
        `/projects/${made.projectId}/settings${tail}`,
        selection.path,
      ),
    );
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === made.publicationPath &&
        url.searchParams.get("settings") === pane,
    );
    await expectSettingsHandoff(page, pane, title, selection.path);
  }
  // A component variant is an entry with its own path, so the variant the
  // reader chose travels as the catalogue screen itself.
  const permalinkQuery =
    "view=changes&catalogueScreen=notice%2Fdraft&viewport=both" +
    "&scheme=dark&search=notice&handoff=one%26two+literal%2Bplus%23notes" +
    "&tag=a&tag=b";
  await page.goto(
    `/projects/${made.projectId}/settings/tokens?${permalinkQuery}`,
  );
  await expect(page).toHaveURL((url) => url.pathname === made.publicationPath);
  expect(new URL(page.url()).search).toBe(`?${permalinkQuery}&settings=tokens`);
  await expectSettingsHandoff(
    page,
    "tokens",
    "Publishing tokens",
    "notice/draft",
  );
  const carriedQuery =
    "settings=tokens&view=changes&catalogueScreen=notice%2Fdraft" +
    "&viewport=both&scheme=dark&search=notice&tag=a&tag=b" +
    "&handoff=one%26two+literal%2Bplus%23notes-%C3%A9quipe-%E6%9D%B1%E4%BA%AC";
  const destination = `${await branchPathFor(page, made.projectId, branch)}&${carriedQuery}`;
  let storedReturnTo: string | undefined;
  const rememberReturnTo = (request: Request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/v1/auth/magic-links"
    ) {
      storedReturnTo = (request.postDataJSON() as { returnTo?: string })
        .returnTo;
    }
  };
  page.on("request", rememberReturnTo);
  await endSession(page);
  reopenSignInWindow(made.email);
  await signIn(page, made.email, destination);
  page.off("request", rememberReturnTo);

  expect(storedReturnTo).toBe(destination);
  await expect(page).toHaveURL((url) => url.pathname === made.publicationPath);
  const returned = new URL(page.url());
  expect(returned.pathname).toBe(made.publicationPath);
  expect(returned.search).toBe(`?${carriedQuery}`);
  expect(returned.searchParams.get("handoff")).toBe(
    "one&two literal+plus#notes-équipe-東京",
  );
  expect(returned.searchParams.getAll("tag")).toEqual(["a", "b"]);
  await expectSettingsHandoff(
    page,
    "tokens",
    "Publishing tokens",
    "notice/draft",
  );
  await expect(publicationReference(page)).toHaveText(branch);
  // The canvas beneath the dialog holds the component's variant set. Its
  // frames have no viewport, so the address is where the reader sees Both.
  await expect(canvasFrame(page, "Draft")).toBeVisible();
  await expect(page).toHaveURL(/viewport=both/);
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(
    savedVariant(page, "Draft", { includeHidden: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("input[data-mokly-search]")).toHaveValue(
    "notice tag:a tag:b",
  );
});

test("retired workspace and project settings links keep viewer state", async ({
  page,
}) => {
  const made = await publishedProject(page, "retired-settings-handoff");
  const selection = await shareSelection(
    page,
    made.projectId,
    made.publicationId,
  );
  const workspaceId = await currentWorkspaceId(page);
  await retireAddressSlugs(
    page,
    workspaceId,
    made.projectId,
    uniqueSlug("settings-team"),
    uniqueSlug("settings-project"),
  );

  await page.goto(
    settingsLink(
      `/${made.workspaceSlug}/${made.projectSlug}/settings/access`,
      selection.path,
    ),
  );
  await expectSettingsHandoff(page, "access", "Access", selection.path);

  await page.goto(
    settingsLink(`/${made.workspaceSlug}/-/settings/members`, selection.path),
  );
  await expectSettingsHandoff(page, "members", "Members", selection.path);

  const returned = settingsLink(
    `/${made.workspaceSlug}/${made.projectSlug}/settings/access`,
    selection.path,
  );
  await endSession(page);
  await page.goto(returned);
  await page.waitForURL((url) => url.pathname === "/sign-in");
  expectExactReturnTo(page.url(), returned);
  reopenSignInWindow(made.email);
  await signIn(page, made.email, returned);
  await expectSettingsHandoff(page, "access", "Access", selection.path);
});
