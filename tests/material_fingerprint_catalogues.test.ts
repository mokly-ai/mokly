import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execute = promisify(execFile);

test("existing inline, CSS and Changes catalogues equal M8 text materials in both modes", async (context) => {
  const files = (await fs.readdir("tests"))
    .filter(
      (name) => name.endsWith(".test.ts") && /inline|css|changes/.test(name),
    )
    .sort()
    .map((name) => `tests/${name}`);
  assert.ok(files.length >= 90);
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const directory = await fs.mkdtemp(
    path.resolve(".context/fingerprint-catalogues-"),
  );
  let successful = false;
  context.after(async () => {
    if (successful) await fs.rm(directory, { recursive: true, force: true });
  });
  const { stdout, stderr } = await execute(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--import",
      "tsx",
      "--import",
      "./tests/helpers/fingerprint_catalogue_probe.mjs",
      "--test",
      "--test-concurrency=2",
      ...files,
    ],
    { cwd: process.cwd(), env: environment, maxBuffer: 32 * 1024 ** 2 },
  ).catch(async (error: { stdout?: string; stderr?: string }) => {
    await fs.writeFile(path.join(directory, "stdout.log"), error.stdout ?? "");
    await fs.writeFile(path.join(directory, "stderr.log"), error.stderr ?? "");
    throw new Error(
      `Catalogue differential subprocess failed; logs: ${directory}`,
    );
  });
  const records = stdout
    .split("\n")
    .filter((line) => line.startsWith("Fingerprint catalogue proof "))
    .map(
      (line) =>
        JSON.parse(line.slice("Fingerprint catalogue proof ".length)) as {
          file?: string;
          catalogues: number;
          pairs: number;
          fingerprintHashes: number;
          fingerprintedViews: number;
          failures: number;
          excludedCatalogues: number;
          excludedPairs: number;
        },
    );
  if (process.env.MOKLY_FINGERPRINT_EVIDENCE) {
    await fs.writeFile(
      process.env.MOKLY_FINGERPRINT_EVIDENCE,
      JSON.stringify(records, null, 2) + "\n",
    );
    await fs.writeFile(
      process.env.MOKLY_FINGERPRINT_EVIDENCE + ".stdout.log",
      stdout,
    );
    await fs.writeFile(
      process.env.MOKLY_FINGERPRINT_EVIDENCE + ".stderr.log",
      stderr,
    );
  }
  const total = (
    field:
      | "catalogues"
      | "pairs"
      | "fingerprintedViews"
      | "excludedCatalogues"
      | "excludedPairs",
  ) => records.reduce((sum, row) => sum + row[field], 0);
  assert.deepEqual(
    {
      catalogues: total("catalogues"),
      pairs: total("pairs"),
      fingerprintedViews: total("fingerprintedViews"),
      excludedCatalogues: total("excludedCatalogues"),
      excludedPairs: total("excludedPairs"),
    },
    {
      catalogues: 432,
      pairs: 860,
      fingerprintedViews: 7612,
      excludedCatalogues: 2,
      excludedPairs: 4,
    },
  );
  for (const record of records) {
    assert.equal(record.failures, 0, record.file ?? "runner");
    assert.equal(
      record.pairs,
      2 * (record.catalogues - record.excludedCatalogues),
      record.file ?? "runner",
    );
  }
  context.diagnostic(
    `${files.length} files, ${records.reduce((sum, row) => sum + row.catalogues, 0)} catalogues, ${records.reduce((sum, row) => sum + row.pairs, 0)} committed/derived pairs, ${records.reduce((sum, row) => sum + row.fingerprintedViews, 0)} fingerprinted views, ${records.reduce((sum, row) => sum + row.fingerprintHashes, 0)} fingerprint hashes; ${total("excludedCatalogues")} named exclusions (${total("excludedPairs")} pairs)`,
  );
  successful = true;
});
