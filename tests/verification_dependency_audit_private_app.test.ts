import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDependencyAudit } from "../scripts/verification/dependency-audit-evaluation.mjs";

import { issueMessages } from "./helpers/dependency_audit.js";
import { privateAppAuditFixture } from "./helpers/dependency_audit_private_app.js";

test("private-app record covers a real private workspace path", () => {
  const { report, lockfile, exception, today, workspaces } =
    privateAppAuditFixture();
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [exception],
    today,
    workspaces,
  );
  assert.equal(result.ok, true, issueMessages(result));
  assert.equal(result.notices.length, 1);
});

test("private-app record rejects published production reach through workspace links", () => {
  const { report, lockfile, exception, today, workspaces } =
    privateAppAuditFixture();
  lockfile.packages["packages/viewer"]!.optionalDependencies = { bridge: "*" };
  lockfile.packages["node_modules/bridge"] = {
    link: true,
    resolved: "packages/bridge",
  };
  lockfile.packages["packages/bridge"] = {
    peerDependencies: { parent: "*" },
  };
  const result = evaluateDependencyAudit(report, lockfile, [exception], today, {
    ...workspaces,
    "packages/bridge": { private: true },
  });
  assert.equal(result.ok, false);
  assert.match(
    issueMessages(result),
    /published workspace packages\/viewer.*production/u,
  );
});

test("private-app record rejects a non-existent dependency edge", () => {
  const { report, lockfile, exception, today, workspaces } =
    privateAppAuditFixture();
  lockfile.packages["node_modules/parent"]!.dependencies = {};
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [exception],
    today,
    workspaces,
  );
  assert.equal(result.ok, false);
  assert.match(
    issueMessages(result),
    /no dependency edge.*parent.*vulnerable/u,
  );
});

test("private-app record leaves a second vulnerable location uncovered", () => {
  const { report, lockfile, exception, today, workspaces } =
    privateAppAuditFixture();
  report.vulnerabilities.vulnerable!.nodes.push(
    "node_modules/other/node_modules/vulnerable",
  );
  lockfile.packages["node_modules/other/node_modules/vulnerable"] = {};
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [exception],
    today,
    workspaces,
  );
  assert.equal(result.ok, false);
  const finding = result.issues.find((issue) => issue.kind === "finding");
  assert.deepEqual(finding?.installLocations, [
    "node_modules/other/node_modules/vulnerable",
  ]);
  assert.equal(result.notices.length, 1);
});

test("private-app record rejects an end date more than 31 days ahead", () => {
  const { report, lockfile, exception, today, workspaces } =
    privateAppAuditFixture();
  exception.until = "2026-12-19";
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [exception],
    today,
    workspaces,
  );
  assert.equal(result.ok, false);
  assert.match(issueMessages(result), /more than 31 days ahead/u);
});

test("each vulnerable location needs its own record even on dev-only paths", () => {
  const { report, lockfile, exception, today, workspaces } =
    privateAppAuditFixture();
  const secondPath = [
    "node_modules/tool",
    "node_modules/tool/node_modules/vulnerable",
  ];
  lockfile.packages[secondPath[0]!] = {
    dev: true,
    dependencies: { vulnerable: "*" },
  };
  lockfile.packages[secondPath[1]!] = { dev: true };
  report.vulnerabilities.vulnerable!.nodes.push(secondPath[1]!);
  const { kind: _kind, ...devOnly } = exception;
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [exception, { ...devOnly, path: secondPath }],
    today,
    workspaces,
  );
  assert.equal(result.ok, true, issueMessages(result));
  assert.equal(result.notices.length, 2);
});

test("private-app scope needs its marker and a private apps workspace", () => {
  const { report, lockfile, exception, today, workspaces } =
    privateAppAuditFixture();
  const { kind: _kind, ...devOnly } = exception;
  const unmarked = evaluateDependencyAudit(
    report,
    lockfile,
    [devOnly],
    today,
    workspaces,
  );
  assert.equal(unmarked.ok, false);
  assert.match(issueMessages(unmarked), /normalized install locations/u);
  const published = evaluateDependencyAudit(
    report,
    lockfile,
    [exception],
    today,
    { ...workspaces, "apps/app": {} },
  );
  assert.equal(published.ok, false);
  assert.match(
    issueMessages(published),
    /must start at a private apps\/ workspace/u,
  );
});

test("different paths cannot accept the same advisory location twice", () => {
  const { report, lockfile, exception, today, workspaces } =
    privateAppAuditFixture();
  lockfile.packages["apps/app"]!.dependencies!.vulnerable = "*";
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [
      exception,
      { ...exception, path: ["apps/app", "node_modules/vulnerable"] },
    ],
    today,
    workspaces,
  );
  assert.equal(result.ok, false);
  assert.match(issueMessages(result), /one reviewed record per location/u);
  assert.equal(result.notices.length, 1);
});

test("published development edges and nearer private installs do not widen production reach", () => {
  const { report, lockfile, exception, today, workspaces } =
    privateAppAuditFixture();
  lockfile.packages["packages/viewer"]!.devDependencies = { parent: "*" };
  const devOnly = evaluateDependencyAudit(
    report,
    lockfile,
    [exception],
    today,
    workspaces,
  );
  assert.equal(devOnly.ok, true, issueMessages(devOnly));
  lockfile.packages["packages/viewer"]!.peerDependencies = { parent: "*" };
  lockfile.packages["packages/viewer/node_modules/parent"] = {};
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [exception],
    today,
    workspaces,
  );
  assert.equal(result.ok, true, issueMessages(result));
});
