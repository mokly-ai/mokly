import {
  api,
  correlationHeader,
  expectBody,
  mutationHeaders,
} from "../api/client";
import type {
  AccessGrant,
  Branch,
  Publication,
  PullRequest,
  Screen,
  ShareLink,
} from "../api/types";

/** The ref a viewer entry names before a publication is resolved. */
export type PublicationRef =
  { kind: "branch"; name: string } | { kind: "pull-request"; number: number };

/**
 * One page of a cursor-paginated list, and the cursor that continues it.
 *
 * The cursor is the whole reason the envelope is returned rather than its
 * items: a caller handed only the items cannot tell a complete list from the
 * first fifty rows of one, and would show a reader a repository missing every
 * branch after the fiftieth without anything saying so.
 */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * How many rows one page carries when a read asks for no `limit`, which is the
 * OpenAPI `Limit` parameter's default.
 *
 * Exported because the cap's capacity is stated in terms of it — in the comment
 * below, in `docs/protocol/cloud/viewer.md` and in the browser test that plants past
 * the cap — and a number restated in four places is one that drifts in three.
 */
export const defaultPageSize = 50;

/**
 * How many pages of one viewer reference or Share screen list are read.
 *
 * The switcher shows every branch and pull request, so it follows the cursor
 * until the list is exhausted. The cap is what keeps a pathological repository
 * from being an unbounded read. Share follows the same bound: twenty pages is
 * `referencePageLimit` times `defaultPageSize` rows, which these reads request — the API's
 * maximum is a hundred. Recorded in `docs/protocol/cloud/viewer.md`.
 */
export const referencePageLimit = 20;

/**
 * Every row a bounded walk read, and whether the bound stopped it early.
 *
 * `truncated` is the reason this is not a bare array. A helper that bounds a
 * read must return the fact that it bounded it: a list that stopped at the cap
 * looks exactly like a complete one, and a reader who cannot find their branch
 * in a thousand rows has no way to learn whether it is missing or merely
 * elsewhere. It is the same rule `Page<T>` exists for, one level up.
 */
export interface PagedItems<T> {
  items: T[];
  truncated: boolean;
}

/** Read one list's pages in API order, until it ends or reaches the cap. */
async function* referencePages<T>(
  read: (cursor?: string) => Promise<Page<T>>,
): AsyncGenerator<Page<T>> {
  let cursor: string | undefined;
  for (let asked = 0; asked < referencePageLimit; asked += 1) {
    const page = await read(cursor);
    yield page;
    // A page that offers no cursor is the last one, whichever page it is.
    if (page.nextCursor === null) return;
    cursor = page.nextCursor;
  }
}

/**
 * Follow one list's cursor until it is exhausted or the cap is reached, in the
 * order the API returned the rows, saying which of the two stopped it.
 */
export async function followPages<T>(
  read: (cursor?: string) => Promise<Page<T>>,
): Promise<PagedItems<T>> {
  const items: T[] = [];
  let truncated = false;
  for await (const page of referencePages(read)) {
    items.push(...page.items);
    truncated = page.nextCursor !== null;
  }
  return { items, truncated };
}

/** One page of branches, the repository default first, then name ascending. */
export function listBranches(
  projectId: string,
  cursor?: string,
): Promise<Page<Branch>> {
  return expectBody((id) =>
    api.GET("/v1/projects/{projectId}/branches", {
      params: { path: { projectId }, query: { cursor } },
      headers: correlationHeader(id),
    }),
  );
}

/** Every branch of the project, to the last page or to the cap. */
export function everyBranch(projectId: string): Promise<PagedItems<Branch>> {
  return followPages((cursor) => listBranches(projectId, cursor));
}

/** One page of pull requests of the bound repository, open and newest first. */
export function listPullRequests(
  projectId: string,
  cursor?: string,
): Promise<Page<PullRequest>> {
  return expectBody((id) =>
    api.GET("/v1/projects/{projectId}/pull-requests", {
      params: { path: { projectId }, query: { cursor } },
      headers: correlationHeader(id),
    }),
  );
}

/** Every pull request of the bound repository, to the last page or to the cap. */
export function everyPullRequest(
  projectId: string,
): Promise<PagedItems<PullRequest>> {
  return followPages((cursor) => listPullRequests(projectId, cursor));
}

/** The page reads shared by alias resolution and the latest-publication poll. */
export interface ReferenceReads {
  listBranches: typeof listBranches;
  listPullRequests: typeof listPullRequests;
}

/** Read one reference's row, stopping at its page or the unchanged list cap. */
export async function readReferenceRow(
  projectId: string,
  ref: PublicationRef,
  reads: ReferenceReads = { listBranches, listPullRequests },
): Promise<Branch | PullRequest | undefined> {
  const read =
    ref.kind === "branch"
      ? (cursor?: string) => reads.listBranches(projectId, cursor)
      : (cursor?: string) => reads.listPullRequests(projectId, cursor);
  for await (const page of referencePages<Branch | PullRequest>(read)) {
    const row = page.items.find((entry) =>
      ref.kind === "branch"
        ? "name" in entry && entry.name === ref.name
        : "number" in entry && entry.number === ref.number,
    );
    if (row) return row;
  }
  return undefined;
}

/** One immutable publication, scoped to the project that owns it. */
export function getPublication(
  projectId: string,
  publicationId: string,
): Promise<Publication> {
  return expectBody((id) =>
    api.GET("/v1/projects/{projectId}/publications/{publicationId}", {
      params: { path: { projectId, publicationId } },
      headers: correlationHeader(id),
    }),
  );
}

/** Current shareable screens in API order, to the last page or the viewer cap. */
export function listScreens(
  projectId: string,
  publicationId: string,
): Promise<PagedItems<Screen>> {
  return followPages((cursor) =>
    expectBody((id) =>
      api.GET("/v1/projects/{projectId}/publications/{publicationId}/screens", {
        params: { path: { projectId, publicationId }, query: { cursor } },
        headers: correlationHeader(id),
      }),
    ),
  );
}

/** The canonical link for one publication and selection; grants no access. */
export function getShareLink(
  projectId: string,
  publicationId: string,
  selection: {
    screen?: string;
    viewport?: "desktop" | "mobile";
    scheme?: "light" | "dark";
  },
): Promise<ShareLink> {
  return expectBody((id) =>
    api.GET("/v1/projects/{projectId}/publications/{publicationId}/share", {
      params: {
        path: { projectId, publicationId },
        query: {
          catalogueScreen: selection.screen,
          viewport: selection.viewport,
          scheme: selection.scheme,
        },
      },
      headers: correlationHeader(id),
    }),
  );
}

/** One one-use grant and the publication host that exchanges it for a cookie. */
export function issueCatalogueGrant(
  projectId: string,
  publicationId: string,
): Promise<AccessGrant> {
  return expectBody((id) =>
    api.POST(
      "/v1/projects/{projectId}/publications/{publicationId}/access-grants",
      {
        params: {
          path: { projectId, publicationId },
          header: mutationHeaders(),
        },
        headers: correlationHeader(id),
        body: {},
      },
    ),
  );
}
