import { createReadStream } from "node:fs";
import { CancellationToken } from "electron-builder";
import { GitHubPublisher } from "electron-publish";
import { releaseFailure } from "./release-assets.mjs";

/**
 * Keep the pinned publisher's release creation, tag and two-hour cutoff.
 * Override its upload hook so a 422 collision can never enter its delete/retry
 * path. The client has only GET and POST operations, even if a race occurs.
 */
export class AppendOnlyPublisher extends GitHubPublisher {
  constructor(info, version, github) {
    delete process.env.EP_GH_IGNORE_TIME;
    super(
      { cancellationToken: new CancellationToken(), progress: null },
      info,
      version,
      { publish: "always" },
    );
    this.github = github;
    this.uploaded = new Set();
  }

  // HttpPublisher supplies the path as its fifth upload-hook argument.
  async doUpload(name, _arch, size, _processRequest, file) {
    const release = await this._release.value;
    if (release === null)
      throw releaseFailure(`The pinned publisher skipped ${name}`);
    await this.github.upload(release.id, { name, size, file });
    this.uploaded.add(name);
  }
}

/**
 * GitHub transport with no operation that can replace or delete an asset.
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
      throw releaseFailure(
        `GitHub asset lookup returned HTTP ${response.status}`,
      );
    return response.json();
  };
  return {
    release: (tag) => get(`/releases/tags/${encodeURIComponent(tag)}`),
    async assets(id) {
      const assets = [];
      for (let page = 1; ; page++) {
        const batch = await get(
          `/releases/${id}/assets?per_page=100&page=${page}`,
        );
        assets.push(...batch);
        if (batch.length < 100) return assets;
      }
    },
    async upload(id, asset) {
      const body = open(asset.file);
      try {
        const response = await request(
          `https://uploads.github.com${repository}/releases/${id}/assets?name=${encodeURIComponent(asset.name)}`,
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
