import fs from "node:fs";

const VERSION = "(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)";

/** A root release publishes the CLI and viewer with matching version tags. */
export function resolvePublishRefs(input) {
  let cli;
  let viewer;
  if (input.eventName === "workflow_dispatch") {
    cli = input.manualRef;
    viewer = input.manualRef ? `viewer-${input.manualRef}` : undefined;
  } else if (input.eventName === "push") {
    const cliCreated = input.releaseCreated === "true";
    if (!cliCreated) return undefined;
    cli = input.releaseTag;
    viewer = cli?.replace(/^v/u, "viewer-v");
  } else throw new Error(`unsupported release event: ${input.eventName}`);
  if (!cli || !viewer) throw new Error("publish_ref is required");
  validateTag(cli);
  if (viewer) validateTag(viewer, "viewer-");
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
