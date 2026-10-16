import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { parse } from "yaml";

interface Step {
  env?: Record<string, string>;
  with?: { script?: string };
}

test("preview comments update only the Actions bot and report the PR head", async () => {
  const workflow = parse(
    await fs.readFile(".github/workflows/preview.yml", "utf8"),
  ) as { jobs: Record<string, { steps: Step[] }> };
  const scripts = Object.values(workflow.jobs)
    .flatMap((job) => job.steps)
    .filter((step) => step.env?.DEPLOY_STATUS || step.env?.CLEANUP_STATUS);
  assert.equal(scripts.length, 2);
  const AsyncFunction = Object.getPrototypeOf(async () => {})
    .constructor as new (
    ...args: string[]
  ) => (...args: unknown[]) => Promise<void>;
  for (const step of scripts) {
    assert.ok(step.with?.script);
    const updates: Array<{ comment_id: number; body: string }> = [];
    const marker = "<!-- mokly-preview -->";
    const github = {
      paginate: async () => [
        {
          id: 1,
          user: { type: "Bot", login: "unrelated[bot]" },
          body: `${marker}\nforeign`,
        },
        {
          id: 2,
          user: { type: "Bot", login: "github-actions[bot]" },
          body: `${marker}\nowned`,
        },
      ],
      rest: {
        issues: {
          listComments: () => {},
          updateComment: async (update: {
            comment_id: number;
            body: string;
          }) => {
            updates.push(update);
          },
          createComment: async () => {
            assert.fail("the owned comment exists");
          },
        },
      },
    };
    await new AsyncFunction("process", "github", "context", step.with.script)(
      {
        env: {
          MOKLY_COMMENT_MARKER: marker,
          DEPLOY_STATUS: "success",
          PREVIEW_BRANCH: "pr-3",
          PREVIEW_URL: "https://pr-3.example.com",
          CLEANUP_STATUS: "deleted",
        },
      },
      github,
      {
        payload: { pull_request: { number: 3, head: { sha: "actual-head" } } },
        sha: "synthetic-merge",
        serverUrl: "https://github.com",
        repo: { owner: "team", repo: "site" },
        runId: 7,
      },
    );
    assert.equal(updates[0]?.comment_id, 2);
    if (step.env?.DEPLOY_STATUS) {
      assert.match(updates[0]!.body, /actual-head/);
      assert.ok(!updates[0]!.body.includes("synthetic-merge"));
    }
  }
});
