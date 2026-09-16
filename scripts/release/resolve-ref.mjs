import { resolvePublishRefs, writeWorkflowOutput } from "./context.mjs";

const refs = resolvePublishRefs({
  eventName: process.env.RELEASE_EVENT ?? "",
  manualRef: process.env.MANUAL_REF ?? "",
  releaseCreated: process.env.RELEASE_CREATED ?? "",
  releaseTag: process.env.RELEASE_TAG ?? "",
  manualViewerRef: process.env.MANUAL_VIEWER_REF ?? "",
  viewerReleaseCreated: process.env.VIEWER_RELEASE_CREATED ?? "",
  viewerReleaseTag: process.env.VIEWER_RELEASE_TAG ?? "",
});
writeWorkflowOutput("publish_ref", refs?.cli ?? "");
writeWorkflowOutput("viewer_ref", refs?.viewer ?? "");
process.stdout.write(
  refs
    ? `Selected immutable releases ${refs.viewer}, ${refs.cli}.\n`
    : "No release artifact selected.\n",
);
