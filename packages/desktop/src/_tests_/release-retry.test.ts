import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import {
  publishRelease,
  releaseManifestFilename,
  writeReleaseManifest,
} from "../../scripts/release-assets.mjs";
import type {
  BuildRecord,
  GitHubAsset,
} from "../../scripts/release-assets.mjs";
import {
  readEarlierBuildRecords,
  writeBuildRecord,
} from "../../scripts/release-build-record.mjs";

const identity = {
  owner: "mokly-ai",
  repo: "mokly-desktop",
  tag: "v1.2.3",
  platform: "linux" as const,
};
const previousBuild: BuildRecord = {
  tag: identity.tag,
  platform: identity.platform,
  assets: [
    {
      name: "Mokly-linux-x86_64.AppImage",
      size: 12,
      sha256: "a".repeat(64),
    },
    { name: "Mokly-linux-amd64.deb", size: 34, sha256: "b".repeat(64) },
    { name: "latest-linux.yml", size: 56, sha256: "c".repeat(64) },
  ],
};
const rebuilt = previousBuild.assets.map(({ name, size }) => ({
  name,
  size: size + 1,
  sha256: "f".repeat(64),
  file: `/build/${name}`,
}));

function uploadedAssets(): GitHubAsset[] {
  return previousBuild.assets.map(({ name, size, sha256 }) => ({
    name,
    size,
    state: "uploaded",
    digest: `sha256:${sha256}`,
  }));
}

function retryFixture(existing: GitHubAsset[]) {
  const uploads: string[] = [];
  return {
    uploads,
    publisher: {
      _release: { value: Promise.resolve({ id: 7 }) },
      uploaded: new Set<string>(),
      async upload({ file }: { file: string }) {
        uploads.push(file);
      },
    },
    github: {
      async release() {
        return { id: 7, draft: true, tag_name: identity.tag };
      },
      async assets() {
        return existing;
      },
    },
  };
}

async function historyDirectory(context: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "mokly-build-records-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function saveAttempt(
  directory: string,
  attempt: number,
  record: BuildRecord,
) {
  const artifact = join(directory, `desktop-build-record-linux-${attempt}`);
  await mkdir(artifact);
  await writeBuildRecord(artifact, record);
}

test("a complete uploaded set writes its matching earlier manifest without another upload", async (context) => {
  const directory = await historyDirectory(context);
  await saveAttempt(directory, 1, { ...previousBuild, assets: rebuilt });
  await saveAttempt(directory, 2, previousBuild);
  await saveAttempt(directory, 3, { ...previousBuild, assets: rebuilt });
  const { publisher, github, uploads } = retryFixture([
    ...uploadedAssets(),
    { name: "Mokly-mac-arm64.zip", size: 99, state: "uploaded" },
  ]);
  const log = context.mock.method(console, "log", () => {});
  await writeReleaseManifest(
    directory,
    await publishRelease(rebuilt, publisher, github, identity, () =>
      readEarlierBuildRecords(directory, identity.platform, "3"),
    ),
  );
  assert.deepEqual(uploads, []);
  assert.deepEqual(
    log.mock.calls.map(({ arguments: args }) => args),
    [["Reusing earlier upload for linux v1.2.3."]],
  );
  const saved: unknown = JSON.parse(
    await readFile(join(directory, releaseManifestFilename), "utf8"),
  );
  assert.deepEqual(saved, {
    ...identity,
    release: 7,
    assets: previousBuild.assets,
  });
});

const rejectedAssets: [string, (assets: GitHubAsset[]) => void, RegExp][] = [
  [
    "a different digest",
    (assets) => {
      assets[0].digest = `sha256:${"e".repeat(64)}`;
    },
    /without a matching earlier build record/,
  ],
  [
    "a missing digest",
    (assets) => {
      delete assets[0].digest;
    },
    /without a matching earlier build record/,
  ],
  [
    "a different size",
    (assets) => {
      assets[0].size++;
    },
    /without a matching earlier build record/,
  ],
  [
    "an unfinished asset",
    (assets) => {
      assets[0].state = "starter";
    },
    /without a matching earlier build record/,
  ],
  [
    "a partial set",
    (assets) => assets.pop(),
    /without a complete linux inventory/,
  ],
  [
    "an unexpected platform file",
    (assets) =>
      assets.push({
        name: "Mokly-linux-extra.deb",
        size: 12,
        state: "uploaded",
      }),
    /without a complete linux inventory/,
  ],
];

for (const [scenario, change, reason] of rejectedAssets) {
  test(`a rerun rejects ${scenario} before uploads`, async () => {
    const existing = uploadedAssets();
    change(existing);
    const { publisher, github, uploads } = retryFixture(existing);
    await assert.rejects(
      publishRelease(rebuilt, publisher, github, identity, async () => [
        previousBuild,
      ]),
      reason,
    );
    assert.deepEqual(uploads, []);
  });
}

test("a missing history directory or a current-attempt record alone cannot authorize reuse", async (context) => {
  const directory = await historyDirectory(context);
  await saveAttempt(directory, 2, previousBuild);
  for (const records of [join(directory, "missing"), directory]) {
    const { publisher, github, uploads } = retryFixture(uploadedAssets());
    await assert.rejects(
      publishRelease(rebuilt, publisher, github, identity, () =>
        readEarlierBuildRecords(records, identity.platform, "2"),
      ),
      /without a matching earlier build record/,
    );
    assert.deepEqual(uploads, []);
  }
});
