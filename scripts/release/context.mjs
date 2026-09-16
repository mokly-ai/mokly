import fs from "node:fs";

const VERSION = "(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)";

export function resolvePublishRef({
  eventName,
  manualRef,
  releaseCreated,
  releaseTag,
}) {
  if (eventName === "workflow_dispatch") {
    if (!manualRef) throw new Error("manual publish_ref is required");
    validateTag(manualRef);
    return manualRef;
  }
  if (eventName === "push" && releaseCreated === "true") {
    if (!releaseTag) throw new Error("release-please omitted its release tag");
    validateTag(releaseTag);
    return releaseTag;
  }
  if (eventName === "push") return undefined;
  throw new Error(`unsupported release event: ${eventName}`);
}

export function resolvePublishRefs(input) {
  const cli = resolvePublishRef(input);
  if (!cli) {
    if (input.viewerReleaseCreated === "true")
      throw new Error("viewer release requires a paired CLI release");
    return undefined;
  }
  const viewer =
    input.eventName === "workflow_dispatch"
      ? input.manualViewerRef
      : input.viewerReleaseCreated === "true"
        ? input.viewerReleaseTag
        : undefined;
  if (!viewer) throw new Error("a paired immutable viewer_ref is required");
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
