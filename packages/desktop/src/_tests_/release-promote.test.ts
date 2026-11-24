import assert from "node:assert/strict";
import test from "node:test";

import { promoteRelease } from "../../scripts/release-promote.mjs";

const tag = "v1.2.3";
const latestMarkAdvice =
  "The release can already be a full release. Rerun the promote job to check the latest mark.";
type LatestRelease = { id: number; tag_name: string } | null;
const draftCalls = ["release 7", "assets 7", "latest", "promote 7", "latest"];

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
  const latest: { before: LatestRelease; after: LatestRelease } = {
    before: null,
    after: { id: 7, tag_name: tag },
  };
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
      release.draft = false;
    },
    async latest() {
      calls.push("latest");
      return release.draft ? latest.before : latest.after;
    },
  };
  return { manifests, release, assets, latest, calls, github };
}

test("promotion verifies the complete inventory and promotes the first full release", async () => {
  const { manifests, github, calls } = fixture();
  await promoteRelease(manifests, github, tag);
  assert.deepEqual(calls, draftCalls);
});

test("a newer latest version leaves the older release in draft and warns", async () => {
  const { manifests, github, latest, calls } = fixture();
  latest.before = { id: 8, tag_name: "v1.10.0" };
  assert.equal(
    await promoteRelease(manifests, github, tag),
    "GitHub's latest release v1.10.0 is newer than v1.2.3. Release v1.2.3 stays a draft.",
  );
  assert.deepEqual(calls, ["release 7", "assets 7", "latest"]);
});

test("an equal or older latest version allows promotion", async () => {
  for (const latestTag of [tag, "v1.1.12"]) {
    const { manifests, github, latest, calls } = fixture();
    latest.before = { id: 6, tag_name: latestTag };
    assert.equal(await promoteRelease(manifests, github, tag), undefined);
    assert.deepEqual(calls, draftCalls);
  }
});

test("a malformed latest tag fails before publication", async () => {
  const { manifests, github, latest, calls } = fixture();
  latest.before = { id: 8, tag_name: "v1.10.0-rc.1" };
  await assert.rejects(promoteRelease(manifests, github, tag), {
    message:
      'Invalid desktop release tag "v1.10.0-rc.1". Expected vMAJOR.MINOR.PATCH. The promotion did not change the release.',
  });
  assert.deepEqual(calls, ["release 7", "assets 7", "latest"]);
});

test("a malformed draft tag fails before publication even with no latest release", async () => {
  const { manifests, github, release, calls } = fixture();
  const malformed = "v1.2";
  release.tag_name = malformed;
  for (const manifest of manifests) manifest.tag = malformed;
  await assert.rejects(promoteRelease(manifests, github, malformed), {
    message:
      'Invalid desktop release tag "v1.2". Expected vMAJOR.MINOR.PATCH. The promotion did not change the release.',
  });
  assert.deepEqual(calls, ["release 7", "assets 7"]);
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
  latest.after = { id: 8, tag_name: "v1.2.4" };
  await assert.rejects(promoteRelease(manifests, github, tag), {
    message: `v1.2.3 is not GitHub's latest release. GitHub returned release 8 as latest, expected 7. ${latestMarkAdvice}`,
  });
  assert.deepEqual(calls, draftCalls);
});

test("a latest lookup network failure after the PATCH reports how to verify the full release", async () => {
  const { manifests, github, release, calls } = fixture();
  const readLatest = github.latest;
  github.latest = async () => {
    const result = await readLatest();
    if (!release.draft) throw new TypeError("fetch failed");
    return result;
  };
  await assert.rejects(promoteRelease(manifests, github, tag), {
    message: `fetch failed. Could not verify that v1.2.3 is GitHub's latest release. ${latestMarkAdvice}`,
  });
  assert.deepEqual(calls, draftCalls);
});

test("no latest release after the PATCH fails", async () => {
  const { manifests, github, latest, calls } = fixture();
  latest.after = null;
  await assert.rejects(promoteRelease(manifests, github, tag), {
    message: `GitHub has no latest release for ${tag}. ${latestMarkAdvice}`,
  });
  assert.deepEqual(calls, draftCalls);
});

test("promotion rechecks a full release without sending another update", async () => {
  const { manifests, github, release, calls } = fixture();
  release.draft = false;
  await promoteRelease(manifests, github, tag);
  assert.deepEqual(calls, ["release 7", "assets 7", "latest"]);
});

test("a full older release leaves the newer latest release in place and warns", async () => {
  const { manifests, github, release, latest, calls } = fixture();
  release.draft = false;
  latest.after = { id: 8, tag_name: "v1.2.10" };
  assert.equal(
    await promoteRelease(manifests, github, tag),
    "GitHub's latest release v1.2.10 is newer than v1.2.3. Release v1.2.3 stays a full release.",
  );
  assert.deepEqual(calls, ["release 7", "assets 7", "latest"]);
});
