import { CancellationToken } from "electron-builder";
import { GitHubPublisher } from "electron-publish";

import { releaseFailure } from "./release-assets.mjs";

/**
 * Reuse the pinned publisher's draft lookup and creation. Handle uploads in
 * the append-only client to keep collisions out of the inherited delete path.
 */
export class AppendOnlyPublisher extends GitHubPublisher {
  /**
   * @param {ConstructorParameters<typeof GitHubPublisher>[1]} info
   * @param {string} version
   * @param {Pick<ReturnType<typeof import("./release-github.mjs").githubClient>, "upload">} github
   */
  constructor(info, version, github) {
    // Drafts return before the publisher's time check. The release rules forbid the bypass.
    delete process.env.EP_GH_IGNORE_TIME;
    delete process.env.EP_PRE_RELEASE;
    delete process.env.EP_PRELEASE;
    super(
      { cancellationToken: new CancellationToken(), progress: null },
      info,
      version,
      { publish: "always" },
    );
    this.github = github;
    /** @type {Set<string>} */
    this.uploaded = new Set();
  }

  /**
   * HttpPublisher supplies the path as its fifth upload-hook argument.
   * @param {string} name
   * @param {import("builder-util").Arch} _arch
   * @param {number} size
   * @param {unknown} _processRequest
   * @param {string} file
   */
  async doUpload(name, _arch, size, _processRequest, file) {
    const release = await this._release.value;
    if (release === null)
      throw releaseFailure(`The pinned publisher skipped ${name}`);
    await this.github.upload(release.id, { name, size, file });
    this.uploaded.add(name);
  }
}
