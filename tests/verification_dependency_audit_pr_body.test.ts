import assert from "node:assert/strict";
import test from "node:test";

import { renderPrBody } from "../scripts/verification/dependency-audit-pr-body.mjs";
import { prConfiguration } from "../scripts/verification/dependency-audit-pr-input.mjs";
import { runDependencyAuditPr } from "../scripts/verification/dependency-audit-pr.mjs";

import { prHarness } from "./helpers/dependency_audit_pr.js";

const recovery =
  "If CI did not start on this pull request, push a commit to the branch or close and reopen the pull request.";

function bodyFor(log: string) {
  const h = prHarness();
  return renderPrBody({
    log,
    now: h.dependencies.clock(),
    configuration: prConfiguration(h.dependencies.env),
  });
}

function assertFields(body: string) {
  assert.ok(body.length <= 65_536);
  assert.match(body, /2026-10-08 \(UTC\)/u);
  assert.ok(
    body.includes("https://github.com/mokly-ai/mokly/actions/runs/1234"),
  );
  assert.ok(
    body.includes(
      "https://github.com/mokly-ai/mokly/blob/main/docs/protocol/dependency-audit-update-pr.md",
    ),
  );
  assert.ok(body.includes(recovery));
  assert.match(body, /compatible updates/u);
  assert.match(body, /pinned-parent override after review/u);
  assert.match(body, /exact dev-only reviewed exception/u);
  assert.match(body, /Do not extend exception dates automatically/u);
}

test("arbitrary log backticks remain inside a longer fence", () => {
  const log = "A ``` fence\n````````\n`another`\nThe final finding.\n";
  const body = bodyFor(log);
  assertFields(body);
  assert.ok(
    body.includes(`\`\`\`\`\`\`\`\`\`text\n${log}\n\`\`\`\`\`\`\`\`\`\n`),
  );
  assert.doesNotMatch(body, /truncated/u);
});

test("oversized logs retain the final evidence with a preceding notice and complete actions", () => {
  const log =
    "OLD-START\n" + "x".repeat(150_000) + "\nFINAL finding and action.\n";
  const body = bodyFor(log);
  assertFields(body);
  assert.ok(body.includes("FINAL finding and action."));
  assert.doesNotMatch(body, /OLD-START/u);
  assert.ok(body.indexOf("Audit log truncated") < body.indexOf("```text"));
});

test("UTF-16 limits count emoji as two units and do not split a surrogate pair", () => {
  const body = bodyFor("HEAD\n" + "😀".repeat(70_000) + "\nTAIL\n");
  assertFields(body);
  assert.ok(body.includes("TAIL"));
  assert.ok(body.includes("😀"));
  for (const character of body) {
    const code = character.charCodeAt(0);
    assert.ok(character.length !== 1 || code < 0xd800 || code > 0xdfff);
  }
});

test("even a very long backtick run is bounded with safe fences around the retained tail", () => {
  const body = bodyFor("`".repeat(100_000));
  assertFields(body);
  const match = body.match(/\n(`+)text\n(`+)\n(`+)\n$/u);
  assert.ok(match);
  assert.equal(match[1]?.length, match[2]!.length + 1);
  assert.equal(match[3], match[1]);
});

test("empty and exact-limit logs need no truncation", () => {
  const empty = bodyFor("");
  assertFields(empty);
  const room = 65_536 - empty.length;
  const body = bodyFor("x".repeat(room));
  assert.equal(body.length, 65_536);
  assert.doesNotMatch(body, /truncated/u);
  assert.match(bodyFor("x".repeat(room + 1)), /truncated/u);
});

test("unrenderable metadata fails before any Git or GitHub call", async () => {
  const h = prHarness();
  h.dependencies.env = {
    ...h.dependencies.env,
    GITHUB_SERVER_URL: `https://github.com/${"x".repeat(70_000)}`,
  };
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assert.deepEqual(h.commands, []);
  assert.deepEqual(h.requests, []);
  assert.match(h.output.errors.join("\n"), /body limit.*retry/u);
});
