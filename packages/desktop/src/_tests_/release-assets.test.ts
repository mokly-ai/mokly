import assert from "node:assert/strict";
import test from "node:test";

import {
  publishRelease,
  releaseArtifacts,
} from "../../scripts/release-assets.mjs";

const artifacts = [
  { name: "Mokly.AppImage", file: "/build/Mokly.AppImage", size: 12 },
  { name: "Mokly.deb", file: "/build/Mokly.deb", size: 34 },
  { name: "latest-linux.yml", file: "/build/latest-linux.yml", size: 56 },
];
const remoteAssets = () =>
  artifacts.map((asset) => ({ ...asset, state: "uploaded" }));

function fixture(
  options: {
    before?: ReturnType<typeof remoteAssets>;
    after?: ReturnType<typeof remoteAssets>;
    skipped?: string[];
    release?: { id: number } | null;
  } = {},
) {
  const calls: string[] = [];
  const publisher = {
    _release: {
      value: Promise.resolve(options.release === null ? null : { id: 7 }),
    },
    uploaded: new Set<string>(),
    async upload({ file }: { file: string }) {
      calls.push(`upload ${file}`);
      const artifact = artifacts.find((item) => item.file === file)!;
      if (!options.skipped?.includes(artifact.name))
        this.uploaded.add(artifact.name);
    },
  };
  let reads = 0;
  const github = {
    async release(tag: string) {
      calls.push(`release ${tag}`);
      return { id: 7 };
    },
    async assets(id: number) {
      calls.push(`assets ${id}`);
      return reads++ === 0
        ? (options.before ?? [])
        : (options.after ?? remoteAssets());
    },
  };
  return { calls, publisher, github };
}

test("release inventory includes packages, blockmaps and update metadata only", async () => {
  const names = [
    "Mokly-mac-arm64.dmg",
    "Mokly-mac-x64.zip",
    "Mokly.AppImage",
    "Mokly.deb",
    "Mokly.dmg.blockmap",
    "latest-mac.yml",
    "latest-linux.yml",
    "builder-debug.yml",
    "builder-effective-config.yaml",
    "linux-unpacked",
  ];
  const inspected: string[] = [];
  const found = await releaseArtifacts("/build", {
    async readdir() {
      return names;
    },
    async stat(file: string) {
      inspected.push(file);
      return { size: 12, isFile: () => true };
    },
  });
  assert.deepEqual(
    found.map((item) => item.name),
    names.slice(0, 7).sort(),
  );
  assert.equal(inspected.length, 7);
  await assert.rejects(
    releaseArtifacts("/build", {
      async readdir() {
        return [];
      },
      async stat() {
        throw new Error("unexpected stat");
      },
    }),
    /No release artifacts/,
  );
});

test("a complete release checks every uploaded file after publishing", async () => {
  const { calls, publisher, github } = fixture();
  await publishRelease(artifacts, publisher, github, "v1.2.3");
  assert.deepEqual(calls, [
    "assets 7",
    ...artifacts.map((asset) => `upload ${asset.file}`),
    "release v1.2.3",
    "assets 7",
  ]);
});

test("a skipped publisher fails even if matching assets appear remotely", async () => {
  const { publisher, github } = fixture({ skipped: [artifacts[1].name] });
  await assert.rejects(
    publishRelease(artifacts, publisher, github, "v1.2.3"),
    /Mokly.deb.*new package version/s,
  );
});

test("a partial, truncated or unfinished release fails", async () => {
  for (const after of [
    remoteAssets().slice(1),
    remoteAssets().map((item, index) =>
      index === 0 ? { ...item, size: 0 } : item,
    ),
    remoteAssets().map((item, index) =>
      index === 0 ? { ...item, state: "starter" } : item,
    ),
  ]) {
    const { publisher, github } = fixture({ after });
    await assert.rejects(
      publishRelease(artifacts, publisher, github, "v1.2.3"),
      /Mokly.AppImage.*new package version/s,
    );
  }
});

test("a delayed publisher skip fails before uploads", async () => {
  const { calls, publisher, github } = fixture({ release: null });
  await assert.rejects(
    publishRelease(artifacts, publisher, github, "v1.2.3"),
    /skipped.*Delayed recovery needs a new package version/s,
  );
  assert.deepEqual(calls, []);
});

test("existing assets fail before uploads and remain untouched", async () => {
  const before = remoteAssets();
  const { calls, publisher, github } = fixture({ before });
  await assert.rejects(
    publishRelease(artifacts, publisher, github, "v1.2.3"),
    /already published.*new package version/s,
  );
  assert.deepEqual(calls, ["assets 7"]);
  assert.deepEqual(before, remoteAssets());
});
