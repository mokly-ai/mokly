import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { readWorkflow, workflowStep } from "./helpers/workflow.js";

const workflow = await readWorkflow("site.yml");
const marker = workflow.env!.MOKLY_COMMENT_MARKER!;
const deploy = workflowStep(
  workflow.jobs["deploy-pr"]!,
  "Comment on pull request",
);
const close = workflowStep(workflow.jobs["close-pr"]!, "Mark preview inactive");

interface Comment {
  body: string;
  id: number;
  user: { type: string };
}

test("site creates one bot comment then updates it with status, URL, commit and run", async () => {
  assert.equal(deploy.if, "always()");
  assert.equal(deploy.env?.DEPLOY_STATUS, "${{ job.status }}");
  assert.equal(deploy.env?.PREVIEW_URL, "${{ env.SITE_ORIGIN }}");
  const comments: Comment[] = [
    { body: marker, id: 1, user: { type: "User" } },
    { body: "<!-- mokly-preview -->", id: 2, user: { type: "Bot" } },
  ];
  let created = 0;
  let updated = 0;
  for (const status of ["success", "failure", "cancelled"]) {
    const calls = await runComment(String(deploy.with?.script), comments, {
      DEPLOY_STATUS: status,
    });
    created += calls.created;
    updated += calls.updated;
    const body = comments[2]!.body;
    assert.match(body, /<!-- mokly-site -->/);
    assert.ok(body.includes(`Status: **${status}**`));
    assert.match(body, /https:\/\/pr-71.mokly-site.pages.dev/);
    assert.match(body, /Commit: test-commit/);
    assert.match(
      body,
      /https:\/\/github.com\/mokly-ai\/mokly\/actions\/runs\/123/,
    );
  }
  assert.equal(created, 1);
  assert.equal(updated, 2);
  assert.equal(comments[0]!.body, marker);
  assert.equal(comments[1]!.body, "<!-- mokly-preview -->");
});

test("close marks only the existing site comment inactive and preserves cleanup failures", async () => {
  assert.equal(close.if, "always()");
  assert.equal(
    close.env?.CLEANUP_STATUS,
    "${{ steps.cleanup.outputs.status }}",
  );
  const comments = [{ body: marker, id: 3, user: { type: "Bot" } }];
  const calls = await runComment(String(close.with?.script), comments, {
    CLEANUP_STATUS:
      "retained: failed to delete 1 Cloudflare deployment(s); deleted 2",
  });
  assert.equal(calls.created, 0);
  assert.equal(calls.updated, 1);
  assert.match(comments[0]!.body, /Status: \*\*inactive\*\*/);
  assert.match(comments[0]!.body, /retained: failed to delete 1/);
  assert.match(comments[0]!.body, /Cloudflare branch: pr-71/);
  assert.match(comments[0]!.body, /actions\/runs\/123/);
  const absent = await runComment(String(close.with?.script), [], {});
  assert.deepEqual(absent, { created: 0, updated: 0 });
  await runComment(String(close.with?.script), comments, {});
  assert.match(comments[0]!.body, /retained: cleanup status unavailable/);
});

async function runComment(
  script: string,
  comments: Comment[],
  environment: Record<string, string>,
) {
  const calls = { created: 0, updated: 0 };
  const issues = {
    listComments: "list-comments",
    async createComment(input: { body: string; issue_number: number }) {
      assert.equal(input.issue_number, 71);
      calls.created++;
      comments.push({ body: input.body, id: 3, user: { type: "Bot" } });
    },
    async updateComment(input: { body: string; comment_id: number }) {
      calls.updated++;
      const comment = comments.find((entry) => entry.id === input.comment_id);
      assert.ok(comment);
      comment.body = input.body;
    },
  };
  await runInNewContext(`(async () => { ${script} })()`, {
    context: {
      payload: { pull_request: { head: { sha: "test-commit" }, number: 71 } },
      repo: { owner: "mokly-ai", repo: "mokly" },
      runId: 123,
      serverUrl: "https://github.com",
    },
    github: {
      paginate: async (method: string, input: { issue_number: number }) => {
        assert.equal(method, "list-comments");
        assert.equal(input.issue_number, 71);
        return comments;
      },
      rest: { issues },
    },
    process: {
      env: {
        MOKLY_COMMENT_MARKER: marker,
        PREVIEW_BRANCH: "pr-71",
        PREVIEW_URL: "https://pr-71.mokly-site.pages.dev",
        ...environment,
      },
    },
  });
  return calls;
}
