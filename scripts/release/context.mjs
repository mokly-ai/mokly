import fs from "node:fs";

const VERSION = "(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)";

/** A publication always selects the CLI and viewer tags from one release. */
export function resolvePublishRefs(input) {
  let cli;
  let viewer;
  if (input.eventName === "workflow_dispatch") {
    cli = input.manualRef;
    viewer = input.manualViewerRef;
  } else if (input.eventName === "push") {
    const cliCreated = input.releaseCreated === "true";
    const viewerCreated = input.viewerReleaseCreated === "true";
    if (!cliCreated && !viewerCreated) return undefined;
    if (!cliCreated || !viewerCreated)
      throw new Error("release-please omitted one release from the tag pair");
    cli = input.releaseTag;
    viewer = input.viewerReleaseTag;
  } else throw new Error(`unsupported release event: ${input.eventName}`);
  if (!cli || !viewer)
    throw new Error("both publish_ref and viewer_ref are required");
  validateTag(cli);
  validateTag(viewer, "viewer-");
  return { cli, viewer };
}

export function validateTagVersion(ref, version, prefix = "") {
  validateTag(ref, prefix);
  const expected = `${prefix}v${version}`;
  if (ref !== expected) {
    throw new Error(
      `release ref ${ref} does not match package version ${version}`,
    );
  }
}

export function remoteTagCommit(output, ref) {
  const lines = output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(/\s+/, 2));
  const dereferenced = lines.find(([, name]) => name === `refs/tags/${ref}^{}`);
  const direct = lines.find(([, name]) => name === `refs/tags/${ref}`);
  const commit = dereferenced?.[0] ?? direct?.[0];
  if (!commit || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error(`origin does not contain immutable tag ${ref}`);
  }
  return commit;
}

export function writeWorkflowOutput(
  name,
  value,
  outputPath = process.env.GITHUB_OUTPUT,
) {
  if (!outputPath) return;
  fs.appendFileSync(outputPath, `${name}=${value}\n`, "utf8");
}

function validateTag(ref, prefix = "") {
  if (!new RegExp(`^${prefix}v${VERSION}$`).test(ref)) {
    throw new Error(
      `publish_ref must be an immutable ${prefix}vX.Y.Z tag: ${ref}`,
    );
  }
}
