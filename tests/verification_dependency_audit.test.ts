import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDependencyAudit } from "../scripts/verification/dependency-audit-evaluation.mjs";

import { auditFixture, bracesAdvisory } from "./helpers/dependency_audit.js";

test("clean audit passes without exceptions", () => {
  const { lockfile, today } = auditFixture();
  assert.deepEqual(
    evaluateDependencyAudit(
      { auditReportVersion: 2, vulnerabilities: {} },
      lockfile,
      [],
      today,
    ),
    { ok: true, errors: [], notices: [] },
  );
});

test("captured audit covers one advisory and twelve effects with Metro cycles", () => {
  const { report, lockfile, exception, today } = auditFixture();
  assert.equal(Object.keys(report.vulnerabilities).length, 13);
  const result = evaluateDependencyAudit(report, lockfile, [exception], today);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.notices.length, 1);
  for (const value of [
    exception.advisory,
    exception.package,
    ...exception.path,
    exception.until,
    "31 days left",
    exception.reason,
    exception.tracking,
  ])
    assert.ok(result.notices[0]!.includes(value), value);
});

test("inclusive UTC end date passes until the last millisecond", () => {
  const { report, lockfile, exception } = auditFixture();
  const result = evaluateDependencyAudit(
    report,
    lockfile,
    [exception],
    new Date("2026-11-03T23:59:59.999Z"),
  );
  assert.equal(result.ok, true);
  assert.match(result.notices[0]!, /0 days left/u);
});

for (const date of ["2026-11-04T00:00:00Z", "2026-10-02T23:59:59.999Z"]) {
  test(`exception fails outside its expiry or 31-day window: ${date}`, () => {
    const { report, lockfile, exception } = auditFixture();
    const result = evaluateDependencyAudit(
      report,
      lockfile,
      [exception],
      new Date(date),
    );
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /expired|31 days/u);
    assert.ok(
      result.errors.some((error) => error.includes(exception.advisory)),
    );
  });
}

test("stale exceptions fail even after the advisory disappears", () => {
  const { lockfile, exception, today } = auditFixture();
  for (const current of [today, new Date("2026-11-04")]) {
    const result = evaluateDependencyAudit(
      { auditReportVersion: 2, vulnerabilities: {} },
      lockfile,
      [exception],
      current,
    );
    assert.equal(result.ok, false);
    assert.match(
      result.errors.join("\n"),
      current === today ? /stale/iu : /expired/iu,
    );
    assert.match(result.errors.join("\n"), /Remove|remove/u);
  }
});

for (const severity of ["low", "moderate", "high", "critical"] as const) {
  test(`another package advisory fails at severity ${severity}`, () => {
    const { report, lockfile, exception, today } = auditFixture();
    const advisory = {
      ...bracesAdvisory(report),
      name: "other",
      dependency: "other",
      severity,
      title: "Other failure",
      url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
    };
    report.vulnerabilities.other = {
      name: "other",
      severity,
      via: [advisory],
      nodes: ["node_modules/other"],
      effects: [],
    };
    const result = evaluateDependencyAudit(
      report,
      lockfile,
      [exception],
      today,
    );
    assert.equal(result.ok, false);
    for (const value of [
      "GHSA-aaaa-bbbb-cccc",
      "other",
      severity,
      advisory.title,
      advisory.url,
      "node_modules/other",
    ])
      assert.ok(result.errors.join("\n").includes(value), value);
  });
}

test("another braces advisory is not covered", () => {
  const { report, lockfile, exception, today } = auditFixture();
  report.vulnerabilities.braces!.via.push({
    ...bracesAdvisory(report),
    url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
  });
  const result = evaluateDependencyAudit(report, lockfile, [exception], today);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /GHSA-aaaa-bbbb-cccc/u);
});

test("second braces installation fails", () => {
  const { report, lockfile, exception, today } = auditFixture();
  report.vulnerabilities.braces!.nodes.push(
    "node_modules/other/node_modules/braces",
  );
  assert.equal(
    evaluateDependencyAudit(report, lockfile, [exception], today).ok,
    false,
  );
});

for (const owner of ["", "packages/viewer", "node_modules/other"]) {
  for (const scope of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const) {
    for (const dependency of ["braces", "micromatch"]) {
      test(`new ${scope} dependent ${owner || "root"} -> ${dependency} fails`, () => {
        const { report, lockfile, exception, today } = auditFixture();
        const entry = (lockfile.packages[owner] ??= {});
        entry[scope] = { ...entry[scope], [dependency]: "*" };
        const result = evaluateDependencyAudit(
          report,
          lockfile,
          [exception],
          today,
        );
        assert.equal(result.ok, false);
        assert.match(result.errors.join("\n"), /path|dependent/u);
      });
    }
  }
}

test("nearest node_modules prevents unrelated private copies from matching", () => {
  const { report, lockfile, exception, today } = auditFixture();
  lockfile.packages["node_modules/other"] = {
    dependencies: { braces: "*", micromatch: "*" },
  };
  lockfile.packages["node_modules/other/node_modules/braces"] = { dev: true };
  lockfile.packages["node_modules/other/node_modules/micromatch"] = {
    dev: true,
  };
  assert.equal(
    evaluateDependencyAudit(report, lockfile, [exception], today).ok,
    true,
  );
});

test("scoped dependency resolution checks enclosing node_modules", () => {
  const { report, lockfile, exception, today } = auditFixture();
  lockfile.packages["node_modules/@scope/other"] = {
    peerDependencies: { braces: "*" },
  };
  assert.equal(
    evaluateDependencyAudit(report, lockfile, [exception], today).ok,
    false,
  );
});

for (const location of auditFixture().exception.path) {
  for (const flags of [
    { dev: false },
    { dev: undefined },
    { dev: true, devOptional: true },
    { dev: undefined, devOptional: true },
  ]) {
    test(`production flags ${JSON.stringify(flags)} at ${location} fail`, () => {
      const { report, lockfile, exception, today } = auditFixture();
      const entry = lockfile.packages[location]!;
      delete entry.dev;
      if (flags.dev !== undefined) entry.dev = flags.dev;
      if (flags.devOptional !== undefined)
        entry.devOptional = flags.devOptional;
      assert.equal(
        evaluateDependencyAudit(report, lockfile, [exception], today).ok,
        false,
      );
    });
  }
}

test("broken path and missing lockfile entry fail", () => {
  for (const missing of ["edge", "entry"]) {
    const { report, lockfile, exception, today } = auditFixture();
    if (missing === "entry") delete lockfile.packages[exception.path[1]!];
    else delete lockfile.packages[exception.path[0]!]!.dependencies!.micromatch;
    assert.equal(
      evaluateDependencyAudit(report, lockfile, [exception], today).ok,
      false,
    );
  }
});
