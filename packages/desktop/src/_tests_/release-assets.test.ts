import assert from "node:assert/strict";
import test from "node:test";

import {
  publishRelease,
  releaseArtifacts,
} from "../../scripts/release-assets.mjs";

const artifacts = [
  {
    name: "Mokly-linux-x86_64.AppImage",
    file: "/build/Mokly-linux-x86_64.AppImage",
    size: 12,
  },
  {
    name: "Mokly-linux-amd64.deb",
    file: "/build/Mokly-linux-amd64.deb",
    size: 34,
  },
  { name: "latest-linux.yml", file: "/build/latest-linux.yml", size: 56 },
];
const remoteAssets = () =>
  artifacts.map((asset) => ({ ...asset, state: "uploaded" }));
const identity = {
  owner: "mokly-ai",
  repo: "mokly-desktop",
  tag: "v1.2.3",
  platform: "linux" as const,
};

function fixture(
  options: {
    before?: ReturnType<typeof remoteAssets>;
    after?: ReturnType<typeof remoteAssets>;
    skipped?: string[];
    release?: { id: number } | null;
    remote?: { draft?: boolean; tag_name?: string };
  } = {},
) {
  const calls: string[] = [];
  const publisher = {
    _release: {
      value: Promise.resolve(
        options.release === undefined ? { id: 7 } : options.release,
      ),
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
    async release(id: number) {
      calls.push(`release ${id}`);
      return {
        id: 7,
        draft: true,
        prerelease: false,
        tag_name: "v1.2.3",
        ...options.remote,
      };
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
    "Mokly-linux-x86_64.AppImage",
    "Mokly-linux-amd64.deb",
    "Mokly-mac-arm64.dmg.blockmap",
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

test("a complete draft is checked by id and returns the verified platform manifest", async () => {
  const { calls, publisher, github } = fixture();
  const manifest = await publishRelease(artifacts, publisher, github, identity);
  assert.deepEqual(calls, [
    "assets 7",
    ...artifacts.map((asset) => `upload ${asset.file}`),
    "release 7",
    "assets 7",
  ]);
  assert.deepEqual(manifest, {
    owner: "mokly-ai",
    repo: "mokly-desktop",
    tag: "v1.2.3",
    release: 7,
    platform: "linux",
    assets: [
      { name: "Mokly-linux-x86_64.AppImage", size: 12 },
      { name: "Mokly-linux-amd64.deb", size: 34 },
      { name: "latest-linux.yml", size: 56 },
    ],
  });
});

test("the final upload check rejects a published release or a different tag", async () => {
  for (const remote of [{ draft: false }, { tag_name: "v1.2.4" }]) {
    const { publisher, github } = fixture({ remote });
    await assert.rejects(
      publishRelease(artifacts, publisher, github, identity),
      /Release 7 is not a draft with tag v1\.2\.3/,
    );
  }
});

test("a skipped publisher fails even if matching assets appear remotely", async () => {
  const { publisher, github } = fixture({ skipped: [artifacts[1].name] });
  await assert.rejects(
    publishRelease(artifacts, publisher, github, identity),
    /Mokly-linux-amd64\.deb.*new package version/s,
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
      publishRelease(artifacts, publisher, github, identity),
      /Mokly-linux-x86_64\.AppImage.*new package version/s,
    );
  }
});

test("a publisher skip fails before uploads", async () => {
  const { calls, publisher, github } = fixture({ release: null });
  await assert.rejects(
    publishRelease(artifacts, publisher, github, identity),
    /skipped.*new package version/s,
  );
  assert.deepEqual(calls, []);
});

test("existing assets fail before uploads and remain untouched", async () => {
  const before = remoteAssets();
  const { calls, publisher, github } = fixture({ before });
  await assert.rejects(
    publishRelease(artifacts, publisher, github, identity),
    /already published.*new package version/s,
  );
  assert.deepEqual(calls, ["assets 7"]);
  assert.deepEqual(before, remoteAssets());
});
