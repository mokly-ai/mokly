import path from "node:path";

import { runCommand } from "./command.mjs";
import { remoteTagCommit, writeWorkflowOutput } from "./context.mjs";
import { selectArtifactSource } from "./retry.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const repository = process.env.GITHUB_REPOSITORY;
const ref = process.env.PUBLISH_REF;
if (!repository || !ref)
  throw new Error(
    "release artifact selection requires repository and publish_ref",
  );
const remote = await runCommand(
  "git",
  ["ls-remote", "origin", `refs/tags/${ref}`, `refs/tags/${ref}^{}`],
  { cwd: root },
);
const api = async (resource) => {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/${resource}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok)
    throw new Error(`release artifact lookup failed: HTTP ${response.status}`);
  return await response.json();
};
const selected = await selectArtifactSource(
  {
    eventName: process.env.RELEASE_EVENT,
    manualRunId: process.env.ARTIFACT_RUN_ID,
    runId: process.env.GITHUB_RUN_ID,
    commit: remoteTagCommit(remote.stdout, ref),
    repository,
    version: ref.slice(1),
  },
  {
    run: (id) => api(`actions/runs/${id}`),
    artifacts: async (id) => {
      const result = await api(`actions/runs/${id}/artifacts?per_page=100`);
      if (result.total_count !== result.artifacts?.length)
        throw new Error("incomplete release artifact listing");
      return result.artifacts;
    },
  },
);
writeWorkflowOutput("artifact_run_id", selected?.runId ?? "");
writeWorkflowOutput("artifact_name", selected?.name ?? "");
process.stdout.write(
  selected
    ? `Reuse checked release archives from run ${selected.runId}.\n`
    : "Prepare first-run release archives.\n",
);
