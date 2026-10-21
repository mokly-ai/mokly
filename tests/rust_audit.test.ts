import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  runRustAudit,
  type RustAuditCommand,
} from "../scripts/verification/rust-audit.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const approved = "RUSTSEC-2026-0235";
const lightningcss = { name: "lightningcss", version: "1.0.0-alpha.72" };

function harness(
  options: {
    date?: string;
    packages?: unknown;
    ignore?: unknown;
    metadataText?: string;
    auditText?: string;
    failure?: "metadata" | "install" | "audit";
  } = {},
) {
  const calls: { file: string; args: string[]; cwd: string }[] = [];
  const output: string[] = [];
  const report = {
    settings: { ignore: options.ignore ?? [approved] },
    vulnerabilities: { found: false, count: 0, list: [] },
    warnings: { unmaintained: [{ advisory: { id: "RUSTSEC-2024-0436" } }] },
  };
  const failure = new Error("cargo command failed with advisory evidence");
  const execute: RustAuditCommand = async (file, args, { cwd }) => {
    calls.push({ file, args, cwd });
    if (args[0] === options.failure) throw failure;
    const stdout =
      args[0] === "metadata"
        ? (options.metadataText ??
          JSON.stringify({ packages: options.packages ?? [lightningcss] }))
        : args[0] === "audit"
          ? (options.auditText ?? JSON.stringify(report))
          : "installed cargo-audit\n";
    return { stdout, stderr: "cargo diagnostic\n" };
  };
  return {
    calls,
    output,
    failure,
    run: () =>
      runRustAudit({
        root: "/fixture",
        now: () => new Date(options.date ?? "2026-10-20T00:00:00.000Z"),
        execute,
        write: (message) => {
          output.push(message);
        },
      }),
  };
}

test("Rust audit uses locked metadata and pinned live auditing, retaining informational warnings", async () => {
  const fixture = harness();
  await fixture.run();
  assert.deepEqual(fixture.calls, [
    {
      file: "cargo",
      args: ["metadata", "--locked", "--format-version", "1"],
      cwd: "/fixture",
    },
    {
      file: "cargo",
      args: ["install", "cargo-audit", "--version", "0.22.2", "--locked"],
      cwd: "/fixture",
    },
    {
      file: "cargo",
      args: ["audit", "--json", "--file", "Cargo.lock"],
      cwd: "/fixture",
    },
  ]);
  assert.match(fixture.output.join(""), /RUSTSEC-2024-0436/);
  assert.match(fixture.output.join(""), /cargo diagnostic/);
});

test("Rust exception is valid through January 31 and expires at the next UTC day", async () => {
  await harness({ date: "2027-01-31T23:59:59.999Z" }).run();
  for (const date of ["2027-02-01T00:00:00.000Z", "2028-01-01T00:00:00.000Z"]) {
    const fixture = harness({ date });
    await assert.rejects(fixture.run(), /Review RUSTSEC-2026-0235.*2027-01-31/);
    assert.deepEqual(fixture.calls, []);
  }
});

test("a changed, missing, or second lightningcss version requires review", async () => {
  for (const packages of [
    [{ ...lightningcss, version: "1.0.0-alpha.73" }],
    [],
    [lightningcss, { ...lightningcss, version: "1.0.0-alpha.73" }],
    [{ name: "lightningcss", version: 72 }],
  ]) {
    const fixture = harness({ packages });
    await assert.rejects(
      fixture.run(),
      /Review RUSTSEC-2026-0235.*lightningcss/,
    );
    assert.equal(fixture.calls.length, 1);
  }
});

test("effective cargo-audit settings cannot ignore another advisory", async () => {
  for (const ignore of [
    ["RUSTSEC-2026-9999"],
    [approved, "RUSTSEC-2026-9999"],
  ]) {
    const fixture = harness({ ignore });
    await assert.rejects(
      fixture.run(),
      /Only RUSTSEC-2026-0235 may be ignored/,
    );
    assert.equal(fixture.calls.at(-1)?.args[0], "audit");
  }
  await harness({ ignore: [] }).run();
});

test("missing or malformed native tool reports cannot bypass review", async () => {
  for (const options of [
    { metadataText: "not JSON" },
    { metadataText: "{}" },
    { auditText: "not JSON" },
    { auditText: "{}" },
    { auditText: '{"settings":{"ignore":"RUSTSEC-2026-0235"}}' },
  ])
    await assert.rejects(
      harness(options).run(),
      /Cannot validate the Rust audit/,
    );
});

test("cargo failures propagate without retries or ignored results", async () => {
  for (const failure of ["metadata", "install", "audit"] as const) {
    const fixture = harness({ failure });
    await assert.rejects(fixture.run(), (error) => error === fixture.failure);
    assert.equal(fixture.calls.at(-1)?.args[0], failure);
    assert.equal(
      fixture.calls.filter((call) => call.args[0] === failure).length,
      1,
    );
  }
});

test("the shared npm command enters the enforced Rust audit", async () => {
  const source = await fs.readFile(
    path.join(repositoryRoot, "package.json"),
    "utf8",
  );
  const value: unknown = JSON.parse(source);
  assert.ok(typeof value === "object" && value !== null && "scripts" in value);
  const scripts = value.scripts;
  assert.ok(
    typeof scripts === "object" &&
      scripts !== null &&
      "dependencies:check:rust" in scripts,
  );
  assert.equal(
    scripts["dependencies:check:rust"],
    "node scripts/verification/audit-rust.mjs",
  );
});
