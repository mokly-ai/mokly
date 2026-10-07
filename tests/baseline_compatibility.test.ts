import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { exportCatalogue } from "../dist/export/run.js";
import { publishCatalogue } from "../dist/publish/run.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import { PlainServeReporter } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

const EARLIER_BASELINE_LINE =
  "Changes are unavailable because the comparison base was built with an earlier version of Mokly. Changes will return once the base includes this version.";

test("Serve reports an earlier v7 baseline once and keeps All available", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  await installBaseline(fixture, { version: 7 });
  const output: string[] = [];
  const running = await serve(
    fixture.config,
    { base: "HEAD", port: 0, watch: false },
    { reporter: new PlainServeReporter((value) => output.push(value)) },
  );
  t.after(() => running.close());

  const html = await waitFor(async () => {
    const candidate = await (await fetch(running.url)).text();
    return candidate.includes('data-changes-status="unavailable"')
      ? candidate
      : undefined;
  });
  assert.match(html, /data-filter="all"/);
  assert.equal(
    output.filter((line) => line.trim() === EARLIER_BASELINE_LINE).length,
    1,
  );
});

for (const baseline of [
  ...[2, 3, 4, 5, 6, 7, 8].map((version) => ({ name: `v${version}`, version })),
]) {
  test(`export treats an earlier ${baseline.name} baseline as unavailable`, async (t) => {
    const fixture = await createExportFixture();
    t.after(() => fixture.close());
    await installBaseline(fixture, baseline);
    const messages: string[] = [];
    const result = await exportCatalogue(fixture.config, {
      base: "HEAD",
      outDir: "site",
      incompatibleBaseline: () => messages.push(EARLIER_BASELINE_LINE),
    } as Parameters<typeof exportCatalogue>[1] & {
      incompatibleBaseline: () => void;
    });

    assert.equal(result.comparisonUrl, null);
    const catalogue = JSON.parse(
      await fs.readFile(
        path.join(result.outDir, "mokly-viewer/catalogue.json"),
        "utf8",
      ),
    );
    assert.equal(catalogue.changesStatus, "unavailable");
    assert.equal(catalogue.comparisonUrl, null);
    assert.equal(
      (await fs.readdir(path.join(result.outDir, "mokly-viewer"))).includes(
        "diffs",
      ),
      false,
    );
    assert.deepEqual(messages, [EARLIER_BASELINE_LINE]);
  });
}

test("publish uploads current-only output for an earlier baseline", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  await installBaseline(fixture, { version: 7 });
  await fixture.git("add", "mockups/mokly-generated");
  await fixture.git("commit", "-qm", "test: publish current generated output");
  const messages: string[] = [];
  const requests: Array<{ method: string | undefined; url: string }> = [];
  await publishCatalogue(
    fixture.config,
    {
      endpoint: "https://uploads.example.test/plan",
      token: "fixture-token",
      repository: "github.com/example/catalogue",
      base: "HEAD^",
      out: "published",
    },
    "0.0.0-test",
    {},
    {
      git: new NodeGitCommandRunner(fixture.root),
      export: (config, options) =>
        exportCatalogue(config, {
          ...options,
          incompatibleBaseline: () => messages.push(EARLIER_BASELINE_LINE),
        } as Parameters<typeof exportCatalogue>[1] & {
          incompatibleBaseline: () => void;
        }),
      fetch: async (url, init) => {
        const address = String(url);
        requests.push({ method: init?.method, url: address });
        if (address === "https://uploads.example.test/plan")
          return Response.json({
            schemaVersion: 1,
            upload: {
              id: "baseline-upload",
              expiresAt: "2026-09-28T01:00:00.000Z",
            },
            missing: [],
            blobUrl:
              "https://uploads.example.test/blobs/baseline-upload/{sha256}",
            completeUrl:
              "https://uploads.example.test/uploads/baseline-upload/complete",
          });
        assert.equal(
          address,
          "https://uploads.example.test/uploads/baseline-upload/complete",
        );
        return Response.json({}, { status: 201 });
      },
      now: () => new Date("2026-09-28T00:00:00.000Z"),
      random: () => 0,
      sleep: async () => undefined,
    },
  );

  assert.deepEqual(requests, [
    { method: "POST", url: "https://uploads.example.test/plan" },
    {
      method: "POST",
      url: "https://uploads.example.test/uploads/baseline-upload/complete",
    },
  ]);
  assert.deepEqual(messages, [EARLIER_BASELINE_LINE]);
  const manifest = JSON.parse(
    await fs.readFile(
      path.join(fixture.root, "published/mokly-upload.json"),
      "utf8",
    ),
  );
  assert.equal(manifest.comparisonPath, null);
  assert.equal(manifest.baseSha, null);
});

test("a v10 baseline stays invalid and never uses earlier-version copy", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  await installBaseline(fixture, { version: 10 });
  const messages: string[] = [];
  await assert.rejects(
    exportCatalogue(fixture.config, {
      base: "HEAD",
      outDir: "site",
      incompatibleBaseline: () => messages.push(EARLIER_BASELINE_LINE),
    } as Parameters<typeof exportCatalogue>[1] & {
      incompatibleBaseline: () => void;
    }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "manifest-invalid");
      return true;
    },
  );
  assert.deepEqual(messages, []);
});

test("Serve reports v10 through its ordinary safe diagnostic", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  await installBaseline(fixture, { version: 10 });
  const output: string[] = [];
  const running = await serve(
    fixture.config,
    { base: "HEAD", port: 0, watch: false },
    { reporter: new PlainServeReporter((value) => output.push(value)) },
  );
  t.after(() => running.close());
  await waitFor(async () => {
    const candidate = await (await fetch(running.url)).text();
    return candidate.includes('data-changes-status="unavailable"')
      ? candidate
      : undefined;
  });
  assert.equal(
    output.some((line) => line.trim() === EARLIER_BASELINE_LINE),
    false,
  );
  assert.equal(
    output.some((line) => line.includes("manifest-invalid")),
    true,
  );
});

test("a controlled v9 baseline still produces Changes", async (t) => {
  const fixture = await createExportFixture();
  t.after(() => fixture.close());
  await fs.writeFile(
    fixture.entryPath,
    validEntrySource({ body: "Changed with current Mokly" }),
  );
  const result = await exportCatalogue(fixture.config, {
    base: "HEAD",
    outDir: "site",
  });
  assert.ok(result.comparisonUrl);
  const catalogue = JSON.parse(
    await fs.readFile(
      path.join(result.outDir, "mokly-viewer/catalogue.json"),
      "utf8",
    ),
  );
  assert.equal(catalogue.changesStatus, "ready");
});

async function installBaseline(
  fixture: Awaited<ReturnType<typeof createExportFixture>>,
  baseline: { version: number },
): Promise<void> {
  const canonical = path.join(fixture.generatedDir, "mokly-manifest.json");
  const manifest = JSON.parse(await fs.readFile(canonical, "utf8"));
  manifest.schemaVersion = baseline.version;
  await fs.writeFile(canonical, `${JSON.stringify(manifest)}\n`);
  await fixture.git("add", "-A");
  await fixture.git("commit", "-qm", "test: install historical baseline");
  await fixture.git("update-ref", "refs/remotes/origin/main", "HEAD");
  await writeCompilation(
    await compileCatalogue(fixture.config),
    fixture.config,
  );
}

async function waitFor<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const value = await read();
    if (value !== undefined) return value;
    await setTimeout(25);
  }
  throw new Error("Serve did not settle");
}
