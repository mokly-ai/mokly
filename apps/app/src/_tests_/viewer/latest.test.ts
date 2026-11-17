import assert from "node:assert/strict";
import { test } from "node:test";

import type { Middleware } from "openapi-fetch";

import { api } from "../../api/client";
import type { paths } from "../../api/generated/schema";
import type { Branch, Publication, PullRequest } from "../../api/types";
import type { Page, PublicationRef } from "../../data/publications";
import { readLatestPublication } from "../../viewer/latest";
import { attempt, branchRow, pullRow } from "./build-fixtures";
import { publication } from "./fixtures";

/** API operations answered by the poll's read double. */
const operations = {
  branch: "/v1/projects/{projectId}/branches",
  "pull-request": "/v1/projects/{projectId}/pull-requests",
  history: "/v1/projects/{projectId}/publications",
} as const satisfies Record<string, keyof paths>;

function pageResponse<T>(page: Page<T>): Response {
  return new Response(JSON.stringify(page), {
    headers: { "content-type": "application/json" },
  });
}

test("the poll keeps a ready target after failed attempts fill history", async () => {
  const ref: PublicationRef = { kind: "branch", name: "main" };
  const failed = publication({ id: "p3", state: "failed" });
  let history: Page<Publication> = {
    items: [failed, publication({ id: "p2" }), publication()],
    nextCursor: null,
  };
  let row: Branch | undefined = branchRow("main", {
    latestPublicationId: "p2",
    newestPublication: attempt({ id: "p3", state: "failed" }),
  });
  const requested: string[] = [];
  const interceptor: Middleware = {
    onRequest({ schemaPath }) {
      requested.push(schemaPath);
      return schemaPath === operations.history
        ? pageResponse(history)
        : pageResponse({ items: row ? [row] : [], nextCursor: null });
    },
  };
  api.use(interceptor);
  try {
    assert.equal(await readLatestPublication("project", ref, "p1"), "p2");
    history = {
      items: Array.from({ length: 50 }, (_unused, index) =>
        publication({ id: `failed-${index}`, state: "failed" }),
      ),
      nextCursor: "older-attempts",
    };
    row = branchRow("main", {
      latestPublicationId: "p2",
      newestPublication: attempt({ id: "failed-0", state: "failed" }),
    });
    assert.equal(
      await readLatestPublication("project", ref, "p1"),
      "p2",
      "the ready target remains offered after 50 newer failed attempts",
    );
    assert.equal(await readLatestPublication("project", ref, "p2"), undefined);
    row = branchRow("main", { latestPublicationId: null });
    history = { items: [publication({ id: "p3" })], nextCursor: null };
    assert.equal(await readLatestPublication("project", ref, "p1"), undefined);
    row = branchRow("main", { latestPublicationId: "p3" });
    assert.equal(await readLatestPublication("project", ref, "p1"), "p3");
    row = undefined;
    assert.equal(await readLatestPublication("project", ref, "p1"), undefined);
    assert.deepEqual(requested, Array(6).fill(operations.branch));
  } finally {
    api.eject(interceptor);
  }
});

test("the poll follows reference pages and stops at the matching row", async () => {
  const refs: PublicationRef[] = [
    { kind: "branch", name: "topic" },
    { kind: "pull-request", number: 14 },
  ];
  for (const ref of refs) {
    const rows: (Branch | PullRequest)[] =
      ref.kind === "branch"
        ? [
            branchRow("other"),
            branchRow("topic", { latestPublicationId: "p2" }),
          ]
        : [pullRow({ number: 9 }), pullRow({ latestPublicationId: "p2" })];
    const requested: {
      operation: string;
      projectId: unknown;
      cursor: unknown;
    }[] = [];
    let unavailable = false;
    const interceptor: Middleware = {
      onRequest({ schemaPath, params }) {
        if (unavailable) throw new Error("offline");
        requested.push({
          operation: schemaPath,
          projectId: params.path?.projectId,
          cursor: params.query?.cursor,
        });
        const first = params.query?.cursor === undefined;
        return pageResponse({
          items: [rows[first ? 0 : 1]],
          nextCursor: first ? "target-page" : "unneeded-page",
        });
      },
    };
    api.use(interceptor);
    try {
      assert.equal(
        await readLatestPublication("scoped-project", ref, "p1"),
        "p2",
        ref.kind,
      );
      assert.deepEqual(requested, [
        {
          operation: operations[ref.kind],
          projectId: "scoped-project",
          cursor: undefined,
        },
        {
          operation: operations[ref.kind],
          projectId: "scoped-project",
          cursor: "target-page",
        },
      ]);
      unavailable = true;
      await assert.rejects(readLatestPublication("scoped-project", ref, "p1"), {
        name: "ApiError",
        code: "unavailable",
        reason: "unavailable",
        status: 0,
      });
    } finally {
      api.eject(interceptor);
    }
  }
});
