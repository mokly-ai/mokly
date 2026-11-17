import assert from "node:assert/strict";
import { test } from "node:test";

import type { Branch, PullRequest } from "../../api/types";
import type { PagedItems } from "../../data/publications";
import { resolveEntry } from "../../viewer/entry";
import type {
  EntryReads,
  RoutePullRequests,
  ViewerAddress,
} from "../../viewer/entry";

import { attempt, branchRow, pullRow, summary } from "./build-fixtures";
import { publication } from "./fixtures";

/** One list as a bounded walk returns it. */
function paged<T>(items: T[]): PagedItems<T> {
  return { items, truncated: false };
}

/**
 * The entry's reads, answered from the rows a test gives, with every read
 * recorded in order so a test sees exactly which lists the entry read.
 */
function reads(rows: { branches?: Branch[]; pulls?: PullRequest[] } = {}): {
  double: EntryReads;
  calls: string[];
} {
  const calls: string[] = [];
  const double: EntryReads = {
    getPublication: async (_projectId, id) => {
      calls.push("getPublication");
      return publication({ id, state: "failed", catalogueUrl: null });
    },
    everyBranch: async () => {
      calls.push("everyBranch");
      return paged(rows.branches ?? []);
    },
    listBranches: async () => {
      calls.push("listBranches");
      return { items: rows.branches ?? [], nextCursor: null };
    },
    listPullRequests: async () => {
      calls.push("listPullRequests");
      return { items: rows.pulls ?? [], nextCursor: null };
    },
  };
  return { double, calls };
}

/** The route read no pull request list. */
const noRouteList: RoutePullRequests = async () => undefined;

/** The route's settled pull request list, holding these rows. */
function routeList(pulls: PullRequest[]): RoutePullRequests {
  return async () => paged(pulls);
}

function pullAddress(publishingAllowed = true): ViewerAddress {
  return {
    projectId: "project",
    ref: { kind: "pull-request", number: pullRow().number },
    publishingAllowed,
  };
}

for (const kind of ["branch", "pull-request"] as const) {
  test(`a ${kind} alias opens its ready target after newer attempts fail`, async () => {
    const newestPublication = attempt({ state: "failed" });
    const { double, calls } = reads({
      branches: [
        branchRow("topic", { latestPublicationId: "ready", newestPublication }),
      ],
    });
    let routeReads = 0;
    const route: RoutePullRequests = async () => {
      routeReads += 1;
      return paged([
        pullRow({ latestPublicationId: "ready", newestPublication }),
      ]);
    };
    const address: ViewerAddress = {
      projectId: "project",
      ref:
        kind === "branch"
          ? { kind, name: "topic" }
          : { kind, number: pullRow().number },
      publishingAllowed: true,
    };
    assert.deepEqual(await resolveEntry(address, double, route), {
      kind: "redirect",
      publicationId: "ready",
    });
    assert.deepEqual(calls, kind === "branch" ? ["listBranches"] : []);
    assert.equal(routeReads, kind === "branch" ? 0 : 1);
  });
}

test("a pull request alias takes its row from the route's list and lists none again", async () => {
  const running = summary({ state: "running" });
  const { double, calls } = reads();
  assert.deepEqual(
    await resolveEntry(
      pullAddress(),
      double,
      routeList([pullRow({ newestBuild: running })]),
    ),
    { kind: "build", buildId: running.id, route: false },
  );
  assert.deepEqual(calls, []);
});

test("the route's completed list stands even when it holds no row for the alias", async () => {
  for (const pulls of [[], [pullRow({ number: 15 })]]) {
    const { double, calls } = reads({ pulls: [pullRow({ fork: true })] });
    assert.deepEqual(
      await resolveEntry(pullAddress(), double, routeList(pulls)),
      {
        kind: "unpublished",
        reference: pullAddress().ref,
        closed: undefined,
        fork: false,
      },
    );
    assert.deepEqual(calls, []);
  }
});

test("the entry lists pull requests only when the route has not read them", async () => {
  const { double, calls } = reads({ pulls: [pullRow({ fork: true })] });
  const entry = await resolveEntry(pullAddress(), double, noRouteList);
  assert.equal(entry.kind === "unpublished" && entry.fork, true);
  assert.deepEqual(calls, ["listPullRequests"]);
});

test("a closed pull request whose build still runs shows that build, for every plan", async () => {
  const running = summary({ state: "queued" });
  for (const publishingAllowed of [true, false]) {
    const { double } = reads();
    assert.deepEqual(
      await resolveEntry(
        pullAddress(publishingAllowed),
        double,
        routeList([pullRow({ state: "closed", newestBuild: running })]),
      ),
      { kind: "build", buildId: running.id, route: false },
    );
  }
});

test("a closed pull request or a fork is named while the plan refuses", async () => {
  const { double } = reads();
  for (const row of [
    pullRow({
      state: "merged",
      newestPublication: attempt({ state: "failed" }),
    }),
    pullRow({ fork: true }),
  ]) {
    const entry = await resolveEntry(
      pullAddress(false),
      double,
      routeList([row]),
    );
    assert.deepEqual(entry, {
      kind: "unpublished",
      reference: pullAddress().ref,
      closed: row.state === "merged" ? "merged" : undefined,
      fork: row.fork,
    });
  }
});

test("a branch alias reads its row for every plan from its own branch list", async () => {
  const running = summary({ state: "running" });
  for (const publishingAllowed of [true, false]) {
    const { double, calls } = reads({
      branches: [branchRow("topic", { newestBuild: running })],
    });
    let asked = false;
    const route: RoutePullRequests = async () => {
      asked = true;
      return undefined;
    };
    assert.deepEqual(
      await resolveEntry(
        {
          projectId: "project",
          ref: { kind: "branch", name: "topic" },
          publishingAllowed,
        },
        double,
        route,
      ),
      { kind: "build", buildId: running.id, route: false },
    );
    assert.deepEqual(calls, ["listBranches"]);
    assert.equal(asked, false);
  }
});

test("standalone entry reads the branch list once and offers its default branch", async () => {
  const { double, calls } = reads({
    branches: [
      branchRow("main", {
        newestPublication: attempt({ state: "failed" }),
      }),
    ],
  });
  const entry = await resolveEntry(
    { projectId: "project", publishingAllowed: true },
    double,
    noRouteList,
  );
  assert.equal(entry.kind, "publication");
  assert.deepEqual(calls, ["everyBranch", "getPublication"]);
});
