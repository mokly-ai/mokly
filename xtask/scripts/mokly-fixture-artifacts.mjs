// Preserve producer bytes, freeze the client time, and pack golden archives.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { json } from "./mokly-fixture-runtime.mjs";
import {
  failureCode,
  planReceiver,
  testToken,
} from "./mokly-fixture-upload.mjs";

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const markerPath = ".mokly-export-artifact";
const envelopePath = "mokly-upload.json";
const indexPath = "mokly-viewer/index.json";
const planOrder = [envelopePath, markerPath, indexPath];

async function readPlan(tar, body) {
  const files = new Map();
  await new Promise((resolve, reject) => {
    const parser = tar.list({
      strict: true,
      onReadEntry(entry) {
        assert.equal(entry.type, "File", `Non-file Plan entry: ${entry.path}`);
        assert(!files.has(entry.path), `Repeated Plan entry: ${entry.path}`);
        const chunks = [];
        files.set(entry.path, null);
        entry.on("data", (chunk) => chunks.push(chunk));
        entry.on("end", () => files.set(entry.path, Buffer.concat(chunks)));
      },
    });
    parser.on("error", reject);
    parser.on("end", resolve);
    parser.end(body);
  });
  assert.deepEqual([...files.keys()], planOrder, "Producer Plan order differs");
  return files;
}

function freezeTime(files) {
  const envelope = files.get(envelopePath);
  const marker = files.get(markerPath);
  const manifest = JSON.parse(envelope.toString("utf8"));
  const inventory = JSON.parse(marker.toString("utf8"));
  const declared = inventory.files.filter(({ path }) => path === envelopePath);
  assert.equal(declared.length, 1);
  assert.equal(declared[0].sha256, sha256(envelope));
  assert.equal(declared[0].size, envelope.length);
  assert.equal(manifest.schemaVersion, 3);
  const pattern =
    /("exportedAt"\s*:\s*")\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z(")/g;
  const original = envelope.toString("utf8");
  assert.equal(
    [...original.matchAll(pattern)].length,
    1,
    "Unexpected exportedAt shape",
  );
  const fixed = Buffer.from(
    original.replace(
      pattern,
      (_, before, after) => `${before}2000-01-01T00:00:00.000Z${after}`,
    ),
  );
  assert.equal(fixed.length, envelope.length);
  const digestPattern = new RegExp(
    `("path"\\s*:\\s*"mokly-upload\\.json"\\s*,\\s*"sha256"\\s*:\\s*")${declared[0].sha256}("\\s*,\\s*"size"\\s*:\\s*${envelope.length}\\s*})`,
    "g",
  );
  const markerText = marker.toString("utf8");
  assert.equal(
    [...markerText.matchAll(digestPattern)].length,
    1,
    "Unexpected envelope marker entry shape",
  );
  files.set(envelopePath, fixed);
  files.set(
    markerPath,
    Buffer.from(
      markerText.replace(
        digestPattern,
        (_, before, after) => `${before}${sha256(fixed)}${after}`,
      ),
    ),
  );
}

async function exportPaths(directory, prefix = "") {
  const paths = [];
  for (const entry of await readdir(join(directory, prefix), {
    withFileTypes: true,
  })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      paths.push(...(await exportPaths(directory, path)));
    else {
      assert(entry.isFile(), `Unexpected export entry: ${path}`);
      paths.push(path);
    }
  }
  return paths.sort();
}

async function verifyExport(exported, plan) {
  const inventory = JSON.parse(plan.get(markerPath).toString("utf8"));
  const built = await json(join(exported, markerPath));
  assert.equal(inventory.schemaVersion, 3);
  assert.equal(built.schemaVersion, 3);
  assert.deepEqual(
    inventory.files.filter(({ path }) => path !== envelopePath),
    built.files,
    "Plan marker must declare the build export unchanged, plus the envelope",
  );
  assert.deepEqual(
    await exportPaths(exported),
    [...built.files.map(({ path }) => path), markerPath].sort(),
  );
  assert.deepEqual(
    [...new Set(inventory.files.map(({ path }) => path))].sort(),
    [...built.files.map(({ path }) => path), envelopePath].sort(),
  );
  for (const entry of inventory.files) {
    const bytes =
      plan.get(entry.path) ?? (await readFile(join(exported, entry.path)));
    assert.equal(sha256(bytes), entry.sha256, `Digest differs: ${entry.path}`);
    assert.equal(bytes.length, entry.size, `Size differs: ${entry.path}`);
    if (entry.path !== envelopePath && plan.has(entry.path)) {
      assert(
        bytes.equals(await readFile(join(exported, entry.path))),
        `Plan bytes differ: ${entry.path}`,
      );
    }
  }
  for (const required of ["index.html", "404.html", envelopePath, indexPath]) {
    assert(
      inventory.files.some(({ path }) => path === required),
      `Missing declaration: ${required}`,
    );
  }
  return inventory;
}

async function pack(tar, cwd, file, paths) {
  for (const path of paths) await chmod(join(cwd, path), 0o644);
  await tar.create(
    {
      cwd,
      file,
      gzip: { mtime: 0 },
      portable: true,
      mtime: new Date(0),
      noDirRecurse: true,
    },
    paths,
  );
  return readFile(file);
}

export async function captureArtifacts(tar, runtime, checkout) {
  const exported = join(checkout, ".context/export");
  runtime.run(
    runtime.cli,
    ["build", "--strict", "--out", ".context/export", "--base", "HEAD~1"],
    checkout,
  );
  const receiver = await planReceiver(426);
  let plan;
  try {
    const result = await runtime.publish(
      checkout,
      receiver.endpoint,
      testToken,
    );
    assert.equal(failureCode(result), "upload-unsupported-version");
    assert.equal(result.builds, 1);
    receiver.verify(1);
    plan = await readPlan(tar, receiver.requests[0].body);
  } finally {
    await receiver.close();
  }
  freezeTime(plan);
  const inventory = await verifyExport(exported, plan);
  const manifest = JSON.parse(plan.get(envelopePath).toString("utf8"));
  const index = JSON.parse(plan.get(indexPath).toString("utf8"));
  assert.equal(Object.keys(manifest).length, 10);
  assert.equal(manifest.branch, "fixture");
  assert.equal(manifest.pullRequest, null);
  assert.equal(manifest.configPath, "mokly.config.json");
  assert.deepEqual(manifest.repository, {
    host: "github.com",
    owner: "mokly-ai",
    name: "mokly-cloud",
  });
  assert.equal(
    manifest.headSha,
    runtime.run("git", ["rev-parse", "HEAD"], checkout),
  );
  assert.equal(
    manifest.baseSha,
    runtime.run("git", ["rev-parse", "HEAD~1"], checkout),
  );
  assert.equal(index.baseCommit, manifest.baseSha);
  assert.equal(index.base, manifest.baseRef);
  assert.equal(index.changesStatus, "ready");
  assert.match(
    index.comparisonUrl,
    /^mokly-viewer\/diffs\/generations\/[a-f0-9]{64}\/$/,
  );
  for (const { path } of inventory.files.filter(({ path }) =>
    path.startsWith("mokly-viewer/diffs/"),
  )) {
    assert(
      path.startsWith(index.comparisonUrl),
      `Wrong comparison generation: ${path}`,
    );
  }
  for (const [path, bytes] of plan)
    await writeFile(join(exported, path), bytes);
  const complete = await pack(
    tar,
    exported,
    join(checkout, "dogfood.tar.gz"),
    [...inventory.files.map(({ path }) => path), markerPath].sort(),
  );
  assert(
    complete.length < 640 * 1024,
    `Export exceeds 640 KiB: ${complete.length} bytes`,
  );
  return new Map([
    ["dogfood.tar.gz", complete],
    [
      "plan.tar.gz",
      await pack(tar, exported, join(checkout, "plan.tar.gz"), [
        ...plan.keys(),
      ]),
    ],
    [envelopePath, plan.get(envelopePath)],
    ["inventory.json", plan.get(markerPath)],
    ["index-v9.json", plan.get(indexPath)],
  ]);
}
