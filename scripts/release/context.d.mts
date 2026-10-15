export function resolvePublishRefs(input: {
  eventName: string;
  manualRef?: string;
  releaseCreated?: string;
  releaseTag?: string;
  manualViewerRef?: string;
  viewerReleaseCreated?: string;
  viewerReleaseTag?: string;
}): { cli: string; viewer: string } | undefined;
export function validateTagVersion(
  ref: string,
  version: string,
  prefix?: string,
): void;
export function remoteTagCommit(output: string, ref: string): string;
export function writeWorkflowOutput(
  name: string,
  value: string,
  outputPath?: string,
): void;
