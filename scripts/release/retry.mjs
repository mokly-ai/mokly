/** Select checked release bytes from the first automatic run. Never infer them. */
export async function selectArtifactSource(input, client) {
  const manual = input.eventName === "workflow_dispatch";
  const sourceRun = manual ? input.manualRunId : input.runId;
  if (!/^[1-9]\d*$/.test(sourceRun ?? ""))
    throw new Error(
      "a positive artifact_run_id is required for a manual retry",
    );
  const run = await client.run(sourceRun);
  if (
    run.event !== "push" ||
    run.head_branch !== "main" ||
    run.head_sha !== input.commit ||
    run.path !== ".github/workflows/release.yml" ||
    run.head_repository?.full_name !== input.repository
  )
    throw new Error(
      "release artifacts must come from the original main push for the tagged commit",
    );
  const artifacts = await client.artifacts(sourceRun);
  const name = `mokly-release-${input.version}`;
  const matches = artifacts.filter((artifact) => artifact.name === name);
  if (matches.length > 1)
    throw new Error(`duplicate checked release artifact: ${name}`);
  if (matches[0]?.expired)
    throw new Error(
      `checked release artifact expired: ${name}; do not rebuild published bytes`,
    );
  if (matches.length === 1) return { runId: sourceRun, name };
  if (manual)
    throw new Error(
      `original run has no checked ${name} artifact; retry its failed jobs before any publication`,
    );
  return undefined;
}
