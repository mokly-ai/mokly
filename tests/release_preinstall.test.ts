import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { isBuiltin } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import ts from "typescript";
import { parse } from "yaml";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
interface Workflow {
  jobs: Record<string, { steps: { run?: string }[] }>;
}

test("release scripts before dependency installation have no static package imports", async (t) => {
  const workflows = await Promise.all(
    ["release.yml", "release-prepare.yml"].map(
      async (name) =>
        parse(
          await fs.readFile(
            path.join(repositoryRoot, ".github/workflows", name),
            "utf8",
          ),
        ) as Workflow,
    ),
  );
  const roots = new Set<string>();
  for (const job of workflows.flatMap((workflow) =>
    Object.values(workflow.jobs),
  )) {
    for (const step of job.steps ?? []) {
      const run = step.run ?? "";
      const install = /^\s*npm\s+ci\b/mu.exec(run);
      const beforeInstall = install ? run.slice(0, install.index) : run;
      for (const match of beforeInstall.matchAll(
        /\bnode\s+(?:--[\w-]+(?:=\S+)?\s+)*["']?((?:\.\/)?scripts\/[\w./-]+\.m?js)["']?/gu,
      )) {
        roots.add(path.resolve(repositoryRoot, match[1]!));
      }
      if (install) break;
    }
  }
  assert.ok(
    roots.size > 0,
    "the release workflow must exercise pre-install scripts",
  );
  const visited = new Set<string>();
  for (const root of roots) await checkImports(root, visited);
  t.diagnostic(
    `Checked ${roots.size} entry scripts and ${visited.size} local modules.`,
  );
});

async function checkImports(file: string, visited: Set<string>): Promise<void> {
  if (visited.has(file)) return;
  visited.add(file);
  const source = ts.createSourceFile(
    file,
    await fs.readFile(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) &&
      !ts.isExportDeclaration(statement)
    )
      continue;
    const specifier = statement.moduleSpecifier;
    if (
      !specifier ||
      !ts.isStringLiteral(specifier) ||
      isBuiltin(specifier.text)
    )
      continue;
    assert.match(
      specifier.text,
      /^\.\.?\//u,
      `${path.relative(repositoryRoot, file)} imports package ${specifier.text} before npm ci`,
    );
    await checkImports(
      fileURLToPath(new URL(specifier.text, pathToFileURL(file))),
      visited,
    );
  }
}

test("the tag verification entrypoint works in an isolated checkout without node_modules", async (t) => {
  const fixture = await bootstrapFixture(t);
  await fs.cp(
    path.join(repositoryRoot, "scripts/release"),
    path.join(fixture.root, "scripts/release"),
    { recursive: true },
  );
  await fs.mkdir(path.join(fixture.root, "packages/mokly"), {
    recursive: true,
  });
  await fs.mkdir(path.join(fixture.root, "packages/viewer"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(fixture.root, "packages/mokly/package.json"),
    JSON.stringify({ name: "@mokly/mokly", version: "0.8.0" }),
  );
  await fs.writeFile(
    path.join(fixture.root, "packages/viewer/package.json"),
    JSON.stringify({ name: "@mokly/viewer", version: "0.8.0" }),
  );
  await fixture.git("add", "scripts", "packages");
  await fixture.git(
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "test: release entrypoint",
  );
  const commit = await fixture.git("rev-parse", "HEAD");
  await fixture.git("tag", "v0.8.0");
  await fixture.git("tag", "-a", "viewer-v0.8.0", "-m", "test viewer tag");
  const remote = path.join(path.dirname(fixture.root), "origin.git");
  await execute("git", ["clone", "--bare", fixture.root, remote]);
  await fixture.git("remote", "add", "origin", remote);
  await assert.rejects(fs.stat(path.join(fixture.root, "node_modules")), {
    code: "ENOENT",
  });
  const script = path.join(fixture.root, "scripts/release/verify-ref.mjs");
  const options = {
    cwd: fixture.root,
    env: { ...process.env, NODE_OPTIONS: "" },
  };
  await assert.rejects(
    execute(process.execPath, [script], options),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /usage: verify-ref\.mjs/u);
      assert.doesNotMatch(error.message, /ERR_MODULE_NOT_FOUND/u);
      return true;
    },
  );
  const { stdout, stderr } = await execute(
    process.execPath,
    [script, "v0.8.0"],
    options,
  );
  assert.equal(
    stdout,
    `Verified shared tags v0.8.0 and viewer-v0.8.0 at ${commit}.\n`,
  );
  assert.equal(stderr, "");
});
