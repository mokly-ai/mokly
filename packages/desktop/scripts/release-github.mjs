import { createReadStream } from "node:fs";

import { isReleaseAsset, releaseFailure } from "./release-assets.mjs";

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isReleaseId(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** @param {number} id */
function releasePath(id) {
  if (!isReleaseId(id)) throw releaseFailure("Invalid GitHub release ID");
  return `/releases/${id}`;
}

/**
 * @param {unknown} value
 * @returns {value is {id: number} & Record<string, unknown>}
 */
function hasReleaseId(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    isReleaseId(value.id)
  );
}

/**
 * Read releases and assets, append assets, and promote a draft with a fixed
 * release update. Asset uploads use a single POST.
 * @param {{owner: string, repo: string}} info
 * @param {string} token
 * @param {typeof globalThis.fetch} request
 * @param {(file: string) => import("node:stream").Readable} open
 */
export function githubClient(
  info,
  token,
  request = globalThis.fetch,
  open = createReadStream,
) {
  const repository = `/repos/${encodeURIComponent(info.owner)}/${encodeURIComponent(info.repo)}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  /** @param {string} path @returns {Promise<unknown>} */
  const get = async (path) => {
    const response = await request(
      `https://api.github.com${repository}${path}`,
      {
        method: "GET",
        headers,
        redirect: "error",
      },
    );
    if (!response.ok)
      throw releaseFailure(`GitHub lookup returned HTTP ${response.status}`);
    return response.json().catch(() => {
      throw releaseFailure("GitHub lookup returned invalid JSON");
    });
  };
  return {
    /** @param {number} id */
    async release(id) {
      const release = await get(releasePath(id));
      if (
        !hasReleaseId(release) ||
        typeof release.tag_name !== "string" ||
        typeof release.draft !== "boolean" ||
        typeof release.prerelease !== "boolean"
      )
        throw releaseFailure("GitHub returned invalid release data");
      const { tag_name, draft, prerelease } = release;
      return { id: release.id, tag_name, draft, prerelease };
    },
    async latest() {
      const release = await get("/releases/latest");
      if (!hasReleaseId(release))
        throw releaseFailure("GitHub returned an invalid latest release ID");
      return { id: release.id };
    },
    /** @param {number} id */
    async promote(id) {
      const response = await request(
        `https://api.github.com${repository}${releasePath(id)}`,
        {
          method: "PATCH",
          redirect: "error",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            draft: false,
            prerelease: false,
            make_latest: "true",
          }),
        },
      ).catch(() => {
        throw releaseFailure("GitHub promotion request failed");
      });
      if (!response.ok)
        throw releaseFailure(
          `GitHub promotion returned HTTP ${response.status}`,
        );
      await response.arrayBuffer();
    },
    /**
     * @param {number} id
     * @returns {Promise<(import("./release-assets.mjs").ReleaseAsset & {state: string})[]>}
     */
    async assets(id) {
      const assets = [];
      for (let page = 1; ; page++) {
        const batch = await get(
          `${releasePath(id)}/assets?per_page=100&page=${page}`,
        );
        if (
          !Array.isArray(batch) ||
          !batch.every(
            (asset) =>
              isReleaseAsset(asset) &&
              "state" in asset &&
              typeof asset.state === "string",
          )
        )
          throw releaseFailure("GitHub returned invalid asset data");
        assets.push(...batch);
        if (batch.length < 100) return assets;
      }
    },
    /**
     * @param {number} id
     * @param {import("./release-assets.mjs").ReleaseAsset & {file: string}} asset
     */
    async upload(id, asset) {
      const body = open(asset.file);
      try {
        const response = await request(
          `https://uploads.github.com${repository}${releasePath(id)}/assets?name=${encodeURIComponent(asset.name)}`,
          {
            method: "POST",
            redirect: "error",
            body,
            duplex: "half",
            headers: {
              ...headers,
              "Content-Type": "application/octet-stream",
              "Content-Length": String(asset.size),
            },
          },
        );
        if (!response.ok)
          throw releaseFailure(
            `Upload ${asset.name} returned HTTP ${response.status}`,
          );
        await response.arrayBuffer();
      } finally {
        body.destroy();
      }
    },
  };
}
