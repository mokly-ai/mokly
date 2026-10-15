export function selectArtifactSource(
  input: {
    eventName: string;
    manualRunId?: string;
    runId: string;
    repository: string;
    version: string;
  },
  client: {
    run(id: string): Promise<{
      event: string;
      head_branch: string;
      head_sha: string;
      path: string;
      workflow_id: number;
      head_repository?: { full_name: string };
    }>;
    artifacts(id: string): Promise<{ name: string; expired: boolean }[]>;
  },
): Promise<{ runId: string; name: string } | undefined>;
