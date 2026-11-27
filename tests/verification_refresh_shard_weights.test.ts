import assert from "node:assert/strict";
import test from "node:test";

import {
  completeAppRun,
  greenMainRuns,
} from "../scripts/verification/refresh-shard-weights.mjs";

/** A fake GitHub API that answers each path from a table and records it. */
function api(responses: Record<string, unknown>) {
  const paths: string[] = [];
  const fetch = async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const path = `${url.pathname}${url.search}`;
    paths.push(path);
    if (!(path in responses)) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(responses[path]));
  };
  return {
    paths,
    request: {
      fetch,
      apiUrl: "https://api.example.test",
      repository: "owner/repository",
      token: "token-value",
    },
  };
}

const RUNS =
  "/repos/owner/repository/actions/workflows/ci.yml/runs?branch=main&event=push&status=success&per_page=3";

function jobsPath(runId: string) {
  return `/repos/owner/repository/actions/runs/${runId}/jobs?filter=latest&per_page=100&page=1`;
}

function jobs(...entries: [number, string, string][]) {
  return {
    total_count: entries.length,
    jobs: entries.map(([id, name, conclusion]) => ({ id, name, conclusion })),
  };
}

test("the refresh reads the newest passed CI runs of pushes to main", async () => {
  const { paths, request } = api({
    [RUNS]: { workflow_runs: [{ id: 30 }, { id: 20 }, { id: 10 }] },
  });
  assert.deepEqual(await greenMainRuns(request, 3), ["30", "20", "10"]);
  assert.deepEqual(paths, [RUNS]);
});

test("the app weights come from the newest run in which every App checks shard passed", async () => {
  const { request } = api({
    [jobsPath("30")]: jobs(
      [301, "App checks 1/2", "success"],
      [302, "App checks 2/2", "failure"],
    ),
    [jobsPath("20")]: jobs([201, "App checks 1/2", "success"]),
    [jobsPath("10")]: jobs(
      [101, "App checks 1/2", "success"],
      [100, "Browser (Node 22.15.0, shard 1/2)", "success"],
      [102, "App checks 2/2", "success"],
    ),
  });
  assert.deepEqual(await completeAppRun(request, ["30", "20", "10"]), {
    runId: "10",
    jobIds: [101, 102],
  });
  assert.equal(await completeAppRun(request, ["30", "20"]), null);
});
