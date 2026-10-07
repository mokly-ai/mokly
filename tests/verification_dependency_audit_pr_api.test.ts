import assert from "node:assert/strict";
import test from "node:test";

import { runDependencyAuditPr } from "../scripts/verification/dependency-audit-pr.mjs";

import {
  gitWrites,
  prHarness,
  updatePullRequest,
} from "./helpers/dependency_audit_pr.js";

test("REST uses the required headers and discovers by repository head", async () => {
  const h = prHarness();
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
  assert.equal(
    h.requests[0]?.path,
    "/repos/mokly-ai/mokly/pulls?state=open&head=mokly-ai:dependency-audit/main",
  );
  for (const request of h.requests) {
    assert.equal(request.url.startsWith("https://api.github.com/"), true);
    assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
    assert.equal(request.headers.get("Accept"), "application/vnd.github+json");
    assert.equal(request.headers.get("X-GitHub-Api-Version"), "2022-11-28");
    assert.ok(request.headers.get("User-Agent"));
  }
  assert.doesNotMatch(
    [...h.output.notices, ...h.output.errors].join("\n"),
    /fixture-token|Authorization|Bearer/u,
  );
});

test("an existing label is added without being created again", async () => {
  const h = prHarness();
  h.state.labelExists = true;
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
  assert.equal(
    h.requests.some(
      (r) => r.method === "POST" && r.path === "/repos/mokly-ai/mokly/labels",
    ),
    false,
  );
  assert.ok(
    h.requests.some(
      (r) => r.method === "POST" && r.path.endsWith("/issues/8/labels"),
    ),
  );
});

for (const body of [
  {
    message: "Validation Failed",
    errors: [{ resource: "Label", code: "already_exists", field: "name" }],
  },
  { message: "Label already exists" },
]) {
  test(`a 422 label creation race is accepted: ${body.message}`, async () => {
    const h = prHarness();
    h.responses.set("POST /repos/mokly-ai/mokly/labels", { status: 422, body });
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
    assert.ok(h.requests.some((r) => r.path.endsWith("/issues/8/labels")));
  });
}

for (const [operation, success] of [
  [
    "GET /repos/mokly-ai/mokly/pulls?state=open&head=mokly-ai:dependency-audit/main",
    false,
  ],
  ["GET /repos/mokly-ai/mokly/labels/dependency-audit", false],
  ["POST /repos/mokly-ai/mokly/labels", false],
  ["POST /repos/mokly-ai/mokly/pulls", false],
  ["POST /repos/mokly-ai/mokly/issues/8/labels", false],
  ["PATCH /repos/mokly-ai/mokly/pulls/7", false],
  ["POST /repos/mokly-ai/mokly/issues/7/comments", true],
  ["PATCH /repos/mokly-ai/mokly/pulls/7", true],
] as const) {
  test(`${operation} failure fails the script with operation, status, cause and action`, async () => {
    const h = prHarness(success);
    if (operation.includes("/7")) h.state.pulls = [updatePullRequest()];
    h.responses.set(operation, {
      status: 403,
      body: { message: "Write access denied" },
    });
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    const errors = h.output.errors.join("\n");
    assert.ok(errors.includes(operation));
    assert.match(errors, /403.*Write access denied.*retry/u);
    if (success) assert.deepEqual(gitWrites(h.commands), []);
  });
}

test("422 failures other than an existing label are errors", async () => {
  const h = prHarness();
  h.responses.set("POST /repos/mokly-ai/mokly/labels", {
    status: 422,
    body: { message: "Invalid label", errors: [{ code: "invalid" }] },
  });
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assert.match(h.output.errors.join("\n"), /POST.*labels.*422.*Invalid label/u);
});

for (const errors of ["invalid label fields", { code: "invalid" }]) {
  test("422 errors with unexpected details still retain the GitHub operation and message", async () => {
    const h = prHarness();
    h.responses.set("POST /repos/mokly-ai/mokly/labels", {
      status: 422,
      body: { message: "Invalid label", errors },
    });
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    assert.match(
      h.output.errors.join("\n"),
      /POST.*labels.*422.*Invalid label/u,
    );
  });
}

test("REST pagination closes all matching requests with the enterprise API base", async () => {
  const h = prHarness(true);
  h.dependencies.env = {
    ...h.dependencies.env,
    GITHUB_API_URL: "https://enterprise.example/api/v3/",
    GITHUB_SERVER_URL: "https://enterprise.example/",
  };
  const first =
    "/api/v3/repos/mokly-ai/mokly/pulls?state=open&head=mokly-ai:dependency-audit/main";
  const second = `${first}&page=2`;
  h.responses.set(`GET ${first}`, {
    status: 200,
    body: [updatePullRequest()],
    headers: { link: `<https://enterprise.example${second}>; rel="next"` },
  });
  h.responses.set(`GET ${second}`, {
    status: 200,
    body: [updatePullRequest(8)],
  });
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, true);
  assert.deepEqual(
    h.requests.filter((r) => r.method === "PATCH").map((r) => r.path),
    [
      "/api/v3/repos/mokly-ai/mokly/pulls/7",
      "/api/v3/repos/mokly-ai/mokly/pulls/8",
    ],
  );
  assert.ok(
    h.requests.every((r) =>
      r.url.startsWith("https://enterprise.example/api/v3/"),
    ),
  );
});

test("pagination cannot send credentials to another server", async () => {
  const h = prHarness(true);
  h.responses.set(
    "GET /repos/mokly-ai/mokly/pulls?state=open&head=mokly-ai:dependency-audit/main",
    {
      status: 200,
      body: [],
      headers: { link: '<https://another.example/pulls>; rel="next"' },
    },
  );
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assert.equal(h.requests.length, 1);
  assert.deepEqual(gitWrites(h.commands), []);
});

test("transport errors redact both tokens and retain the recovery action", async () => {
  const h = prHarness();
  h.dependencies.fetch = async () => {
    throw new Error("fixture-token fixture-gh-token transport failed");
  };
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assert.match(h.output.errors.join("\n"), /transport failed/u);
  assert.doesNotMatch(
    h.output.errors.join("\n"),
    /fixture-token|fixture-gh-token/u,
  );
  assert.deepEqual(h.commands, []);
});

test("malformed REST JSON and pull request identities fail", async () => {
  for (const data of [{}, [{ ...updatePullRequest(), number: null }]]) {
    const h = prHarness();
    h.responses.set(
      "GET /repos/mokly-ai/mokly/pulls?state=open&head=mokly-ai:dependency-audit/main",
      { status: 200, body: data },
    );
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    assert.deepEqual(h.commands, []);
  }
  const h = prHarness();
  h.dependencies.fetch = async () => new Response("not JSON", { status: 502 });
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assert.match(h.output.errors.join("\n"), /GET.*502.*invalid JSON/u);
});
