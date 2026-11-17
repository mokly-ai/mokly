import type { Page, Request } from "@playwright/test";

import {
  branchPathFor,
  currentWorkspaceId,
  expect,
  signIn,
  test,
} from "./harness";
import { apiOrigin } from "./origins";
import { shareSelection, uniqueSlug } from "./readable-addresses-support";
import { publishedProject } from "./viewer/support";

function settingsLink(pathname: string, catalogueScreen: string): string {
  const query = new URLSearchParams();
  query.set("view", "changes");
  query.set("catalogueScreen", catalogueScreen);
  query.append("tag", "a");
  query.append("tag", "b");
  return `${pathname}?${query.toString()}`;
}

function expectExactReturnTo(address: string, destination: string): void {
  const current = new URL(address);
  expect(current.pathname).toBe("/sign-in");
  expect([...current.searchParams]).toEqual([["returnTo", destination]]);
}

async function expectSettingsHandoff(
  page: Page,
  pane: string,
  title: string,
  catalogueScreen: string,
): Promise<void> {
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("settings") === pane,
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText(title);
  const current = new URL(page.url());
  expect(current.searchParams.get("view")).toBe("changes");
  expect(current.searchParams.get("catalogueScreen")).toBe(catalogueScreen);
  expect(current.searchParams.getAll("tag")).toEqual(["a", "b"]);
}

async function endSession(page: Page): Promise<void> {
  await page.evaluate(async (origin) => {
    const sessionAnswer = await fetch(`${origin}/v1/session`, {
      credentials: "include",
    });
    if (!sessionAnswer.ok) {
      throw new Error(`session read failed: ${sessionAnswer.status}`);
    }
    const { csrfToken } = (await sessionAnswer.json()) as {
      csrfToken: string;
    };
    const answer = await fetch(`${origin}/v1/session`, {
      method: "DELETE",
      credentials: "include",
      headers: { "x-csrf-token": csrfToken },
    });
    if (!answer.ok) throw new Error(`sign out failed: ${answer.status}`);
  }, apiOrigin);
  await page.evaluate(() => window.localStorage.clear());
  await page.context().clearCookies();
}

async function retireAddressSlugs(
  page: Page,
  workspaceId: string,
  projectId: string,
  nextWorkspaceSlug: string,
  nextProjectSlug: string,
): Promise<void> {
  await page.evaluate(
    async ([origin, workspace, project, nextWorkspace, nextProject]) => {
      const sessionAnswer = await fetch(`${origin}/v1/session`, {
        credentials: "include",
      });
      if (!sessionAnswer.ok) {
        throw new Error(`session read failed: ${sessionAnswer.status}`);
      }
      const { csrfToken } = (await sessionAnswer.json()) as {
        csrfToken: string;
      };
      const headers = {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      };
      const workspaceAnswer = await fetch(
        `${origin}/v1/workspaces/${workspace}`,
        { credentials: "include" },
      );
      const projectAnswer = await fetch(`${origin}/v1/projects/${project}`, {
        credentials: "include",
      });
      if (!workspaceAnswer.ok || !projectAnswer.ok) {
        throw new Error("address subjects could not be read");
      }
      const currentWorkspace = (await workspaceAnswer.json()) as {
        name: string;
        version: number;
      };
      const currentProject = (await projectAnswer.json()) as {
        name: string;
        visibility: "private" | "public";
        requireApproval: boolean;
        version: number;
      };
      const renamedWorkspace = await fetch(
        `${origin}/v1/workspaces/${workspace}`,
        {
          method: "PATCH",
          credentials: "include",
          headers,
          body: JSON.stringify({
            name: currentWorkspace.name,
            slug: nextWorkspace,
            version: currentWorkspace.version,
          }),
        },
      );
      if (!renamedWorkspace.ok) {
        throw new Error(`workspace rename failed: ${renamedWorkspace.status}`);
      }
      const renamedProject = await fetch(`${origin}/v1/projects/${project}`, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify({
          name: currentProject.name,
          slug: nextProject,
          visibility: currentProject.visibility,
          requireApproval: currentProject.requireApproval,
          version: currentProject.version,
        }),
      });
      if (!renamedProject.ok) {
        throw new Error(`project rename failed: ${renamedProject.status}`);
      }
    },
    [
      apiOrigin,
      workspaceId,
      projectId,
      nextWorkspaceSlug,
      nextProjectSlug,
    ] as const,
  );
}

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
  await expect(page.getByTestId("viewer-publication")).toHaveText(branch);
  await expect(page.locator("[data-mokly-stage]")).toHaveAttribute(
    "data-viewport",
    "both",
  );
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expect(
    page.locator('[data-workspace-variant="notice/draft"]'),
  ).toHaveAttribute("aria-current", "page");
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
  await signIn(page, made.email, returned);
  await expectSettingsHandoff(page, "access", "Access", selection.path);
});
