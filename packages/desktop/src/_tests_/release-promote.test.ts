import assert from "node:assert/strict";
import test from "node:test";

import { promoteRelease } from "../../scripts/release-promote.mjs";

const tag = "v1.2.3";
const latestMarkAdvice =
  "The release can already be a full release. Rerun the promote job to check the latest mark.";

function fixture() {
  const identity = {
    owner: "mokly-ai",
    repo: "mokly-desktop",
    tag,
    release: 7,
  };
  const manifests = [
    {
      ...identity,
      platform: "macos" as const,
      assets: [
        "Mokly-mac-arm64.dmg",
        "Mokly-mac-x64.dmg",
        "Mokly-mac-arm64.zip",
        "Mokly-mac-x64.zip",
        "Mokly-mac-arm64.dmg.blockmap",
        "Mokly-mac-x64.dmg.blockmap",
        "Mokly-mac-arm64.zip.blockmap",
        "Mokly-mac-x64.zip.blockmap",
        "latest-mac.yml",
      ].map((name, index) => ({ name, size: 100 + index })),
    },
    {
      ...identity,
      platform: "linux" as const,
      assets: [
        { name: "Mokly-linux-x86_64.AppImage", size: 110 },
        { name: "Mokly-linux-amd64.deb", size: 111 },
        { name: "latest-linux.yml", size: 112 },
      ],
    },
  ];
  const release = { id: 7, tag_name: tag, draft: true, prerelease: false };
  const assets = manifests.flatMap((manifest) =>
    manifest.assets.map((asset) => ({ ...asset, state: "uploaded" })),
  );
  const latest = { id: 7 };
  const calls: string[] = [];
  const github = {
    async release(id: number) {
      calls.push(`release ${id}`);
      return release;
    },
    async assets(id: number) {
      calls.push(`assets ${id}`);
      return assets;
    },
    async promote(id: number) {
      calls.push(`promote ${id}`);
    },
    async latest() {
      calls.push("latest");
      return latest;
    },
  };
  return { manifests, release, assets, latest, calls, github };
}

test("promotion verifies the complete inventory, updates the draft once and checks latest", async () => {
  const { manifests, github, calls } = fixture();
  await promoteRelease(manifests, github, tag);
  assert.deepEqual(calls, ["release 7", "assets 7", "promote 7", "latest"]);
});

const rejections: [
  name: string,
  change: (data: ReturnType<typeof fixture>) => void,
  reason: RegExp,
  calls: string[],
][] = [
  [
    "a missing platform manifest blocks promotion",
    ({ manifests }) => manifests.pop(),
    /Expected one macOS manifest and one Linux manifest/,
    [],
  ],
  [
    "a manifest for the wrong tag blocks promotion",
    ({ manifests }) => {
      manifests[1].tag = "v1.2.4";
    },
    /Both manifests must have tag v1\.2\.3/,
    [],
  ],
  [
    "manifests for different release ids block promotion",
    ({ manifests }) => {
      manifests[1].release = 8;
    },
    /Manifests have different release IDs/,
    [],
  ],
  [
    "manifests for different repositories block promotion",
    ({ manifests }) => {
      manifests[1].repo = "another-repo";
    },
    /Manifests have different GitHub repositories/,
    [],
  ],
  [
    "a wrong installer name in a manifest blocks promotion",
    ({ manifests }) => {
      manifests[1].assets[0].name = "Mokly-linux-x64.AppImage";
    },
    /The linux manifest has the wrong asset names/,
    [],
  ],
  [
    "a GitHub release with the wrong tag blocks promotion",
    ({ release }) => {
      release.tag_name = "v1.2.4";
    },
    /GitHub release 7 has the wrong tag/,
    ["release 7"],
  ],
  [
    "a GitHub asset with the wrong size blocks promotion",
    ({ assets }) => {
      assets[0].size = 1;
    },
    /Mokly-mac-arm64\.dmg has size 1, expected 100/,
    ["release 7", "assets 7"],
  ],
  [
    "a GitHub asset that is not uploaded blocks promotion",
    ({ assets }) => {
      assets[0].state = "starter";
    },
    /Mokly-mac-arm64\.dmg is not uploaded/,
    ["release 7", "assets 7"],
  ],
  [
    "an extra GitHub asset blocks promotion",
    ({ assets }) =>
      assets.push({ name: "extra.zip", size: 10, state: "uploaded" }),
    /GitHub assets do not match the complete inventory/,
    ["release 7", "assets 7"],
  ],
  [
    "an already published pre-release blocks promotion",
    ({ release }) => {
      release.draft = false;
      release.prerelease = true;
    },
    /GitHub release 7 is a pre-release/,
    ["release 7", "assets 7"],
  ],
];

for (const [name, change, reason, calls] of rejections) {
  test(name, async () => {
    const data = fixture();
    change(data);
    await assert.rejects(
      promoteRelease(data.manifests, data.github, tag),
      (error: Error) => {
        assert.match(error.message, reason);
        assert.match(
          error.message,
          / The promotion did not change the release\.$/,
        );
        return true;
      },
    );
    assert.deepEqual(data.calls, calls);
  });
}

test("promotion fails when GitHub reports a different latest release after the update", async () => {
  const { manifests, github, latest, calls } = fixture();
  latest.id = 8;
  await assert.rejects(promoteRelease(manifests, github, tag), {
    message: `v1.2.3 is not GitHub's latest release. GitHub returned release 8 as latest, expected 7. ${latestMarkAdvice}`,
  });
  assert.deepEqual(calls, ["release 7", "assets 7", "promote 7", "latest"]);
});

test("a latest lookup network failure after the PATCH reports how to verify the full release", async () => {
  const { manifests, github, calls } = fixture();
  github.latest = async () => {
    calls.push("latest");
    throw new TypeError("fetch failed");
  };
  await assert.rejects(promoteRelease(manifests, github, tag), {
    message: `fetch failed. Could not verify that v1.2.3 is GitHub's latest release. ${latestMarkAdvice}`,
  });
  assert.deepEqual(calls, ["release 7", "assets 7", "promote 7", "latest"]);
});

test("promotion rechecks a full release without sending another update", async () => {
  const { manifests, github, release, calls } = fixture();
  release.draft = false;
  await promoteRelease(manifests, github, tag);
  assert.deepEqual(calls, ["release 7", "assets 7", "latest"]);
});
