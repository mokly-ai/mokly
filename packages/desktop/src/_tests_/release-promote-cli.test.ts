import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";

import desktop from "../../package.json" with { type: "json" };
import {
  publishRelease,
  writeReleaseManifest,
} from "../../scripts/release-assets.mjs";
import type { ReleaseAsset } from "../../scripts/release-assets.mjs";
import { releaseInventory } from "../../scripts/release-promote.mjs";

const expectedTag = `v${desktop.version}`;
const command = fileURLToPath(
  new URL("../../scripts/release-promote.mjs", import.meta.url),
);
const owner = "mokly-ai";
const repo = "mokly-desktop";
const releaseId = 7;
const releasesUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
const releaseUrl = `${releasesUrl}/${releaseId}`;

async function runPromotion(context: TestContext, tag: string) {
  const directory = await mkdtemp(join(tmpdir(), "mokly-release-promote-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  const draft = {
    id: releaseId,
    tag_name: tag,
    draft: true,
    prerelease: false,
  };
  const assets: (ReleaseAsset & { state: "uploaded" })[] = [];
  const github = {
    async release(id: number) {
      assert.equal(id, releaseId);
      return draft;
    },
    async assets(id: number) {
      assert.equal(id, releaseId);
      return assets.slice();
    },
  };
  const releaseIds: number[] = [];
  for (const platform of ["macos", "linux"] as const) {
    const artifacts = releaseInventory[platform].map((name, index) => ({
      name,
      file: join(directory, platform, name),
      size: index + 1,
    }));
    const publisher = {
      _release: { value: Promise.resolve({ id: releaseId }) },
      uploaded: new Set<string>(),
      async upload({ file }: { file: string }) {
        const asset = artifacts.find((artifact) => artifact.file === file);
        assert.ok(asset, `Unexpected upload of ${file}`);
        this.uploaded.add(asset.name);
        assets.push({ name: asset.name, size: asset.size, state: "uploaded" });
      },
    };
    const manifest = await publishRelease(artifacts, publisher, github, {
      owner,
      repo,
      tag,
      platform,
    });
    const platformDirectory = join(directory, `desktop-release-${platform}`);
    await mkdir(platformDirectory);
    await writeReleaseManifest(platformDirectory, manifest);
    releaseIds.push(manifest.release);
  }

  const patchLog = join(directory, "patches.jsonl");
  const fetchDouble = join(directory, "github-fetch.mjs");
  const remote = { release: draft, assets };
  await writeFile(patchLog, "");
  await writeFile(
    fetchDouble,
    `import { appendFile } from "node:fs/promises";

const { release, assets } = ${JSON.stringify(remote)};
const releaseUrl = ${JSON.stringify(releaseUrl)};

globalThis.fetch = async (url, { method, body }) => {
  if (method === "PATCH") {
    await appendFile(${JSON.stringify(patchLog)}, JSON.stringify({
      url, body: JSON.parse(body),
    }) + "\\n");
    if (url === releaseUrl) {
      release.draft = false;
      return Response.json(release);
    }
  }
  if (method === "GET") {
    if (url === releaseUrl) return Response.json(release);
    if (url.startsWith(releaseUrl + "/assets?")) return Response.json(assets);
    if (url === ${JSON.stringify(`${releasesUrl}/latest`)})
      return Response.json({ id: release.draft ? 6 : release.id });
  }
  throw new Error("Unexpected GitHub request: " + method + " " + url);
};
`,
  );

  const result = spawnSync(
    process.execPath,
    ["--import", fetchDouble, command, directory],
    { encoding: "utf8", env: { GH_TOKEN: "token-fixture" } },
  );
  assert.ifError(result.error);
  const log = await readFile(patchLog, "utf8");
  const patches = log
    .split("\n")
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));
  return { ...result, patches, releaseIds };
}

test("the promotion command publishes the manifests from the platform artifact directories", async (context) => {
  const result = await runPromotion(context, expectedTag);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.releaseIds, [releaseId, releaseId]);
  assert.deepEqual(result.patches, [
    {
      url: `${releasesUrl}/${result.releaseIds[0]}`,
      body: { draft: false, prerelease: false, make_latest: "true" },
    },
  ]);
  assert.equal(result.stdout, `Desktop release ${expectedTag} is latest.\n`);
});

test("the promotion command rejects a manifest tag that differs from the desktop package version", async (context) => {
  const result = await runPromotion(context, `${expectedTag}-other`);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(result.patches, []);
  assert.ok(
    result.stderr.startsWith(`Both manifests must have tag ${expectedTag}.`),
    result.stderr,
  );
});
