import fs from "node:fs";

const VERSION = "(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)";

/** Select the viewer release independently while the CLI package is private. */
export function resolvePublishRefs(input) {
  let viewer;
  if (input.eventName === "workflow_dispatch") {
    viewer = input.manualViewerRef;
    if (!viewer) throw new Error("manual viewer_ref is required");
  } else if (input.eventName === "push") {
    if (input.viewerReleaseCreated !== "true") return undefined;
    viewer = input.viewerReleaseTag;
    if (!viewer) throw new Error("release-please omitted its viewer tag");
  } else throw new Error(`unsupported release event: ${input.eventName}`);
  validateTag(viewer, "viewer-");
  return { viewer };
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
