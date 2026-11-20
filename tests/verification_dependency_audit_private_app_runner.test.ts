import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import { runDependencyAudit } from "../scripts/verification/dependency-audit.mjs";

import { issueMessages } from "./helpers/dependency_audit.js";
import { privateAppAuditFixture } from "./helpers/dependency_audit_private_app.js";
import { auditHarness } from "./helpers/dependency_audit_runner.js";

function privateAppHarness() {
  const h = auditHarness();
  const fixture = privateAppAuditFixture();
  h.dependencies.clock = () => fixture.today;
  h.head.stdout = JSON.stringify(fixture.report);
  h.base.stdout = h.head.stdout;
  h.files.set(
    "package-lock.json",
    Buffer.from(JSON.stringify(fixture.lockfile)),
  );
  h.files.set(
    "scripts/verification/dependency-audit-exceptions.json",
    Buffer.from(JSON.stringify([fixture.exception])),
  );
  for (const [location, manifest] of Object.entries(fixture.workspaces))
    h.files.set(
      `${location}/package.json`,
      Buffer.from(JSON.stringify(manifest)),
    );
  h.baseFiles.clear();
  for (const [file, contents] of h.files) h.baseFiles.set(file, contents);
  return h;
}

test("runner reads actual workspace privacy on every audit", async () => {
  const h = privateAppHarness();
  const first = await runDependencyAudit(h.dependencies);
  assert.equal(first.ok, true, issueMessages(first));
  h.files.set("apps/app/package.json", Buffer.from("{}"));
  const second = await runDependencyAudit(h.dependencies);
  assert.equal(second.ok, false);
  assert.match(
    issueMessages(second),
    /must start at a private apps\/ workspace/u,
  );
});

test("runner fails when any required workspace manifest cannot be read", async () => {
  const h = privateAppHarness();
  h.files.delete("packages/viewer/package.json");
  const result = await runDependencyAudit(h.dependencies);
  assert.equal(result.ok, false);
  assert.match(
    issueMessages(result),
    /Cannot read packages\/viewer\/package.json/u,
  );
  assert.equal(
    result.issues.some((issue) => issue.kind === "input"),
    true,
  );
});

test("baseline comparison includes workspace manifest bytes", async () => {
  const h = privateAppHarness();
  h.dependencies.args = ["--baseline"];
  h.files.set("apps/app/package.json", Buffer.from("{}"));
  const result = await runDependencyAudit(h.dependencies);
  assert.equal(result.ok, false);
  assert.equal(h.state.temporary, 1);
  assert.equal(
    result.issues.every((issue) => "inherited" in issue && !issue.inherited),
    true,
  );
});
