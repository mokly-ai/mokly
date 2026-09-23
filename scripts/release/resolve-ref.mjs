import { resolvePublishRefs, writeWorkflowOutput } from "./context.mjs";
import { resolveVerificationMode } from "./evidence_contract.mjs";

const eventName = process.env.RELEASE_EVENT ?? "";
const refs = resolvePublishRefs({
  eventName,
  manualRef: process.env.MANUAL_REF ?? "",
  releaseCreated: process.env.RELEASE_CREATED ?? "",
  releaseTag: process.env.RELEASE_TAG ?? "",
  manualViewerRef: process.env.MANUAL_VIEWER_REF ?? "",
  viewerReleaseCreated: process.env.VIEWER_RELEASE_CREATED ?? "",
  viewerReleaseTag: process.env.VIEWER_RELEASE_TAG ?? "",
});
const verification = resolveVerificationMode({
  eventName,
  manualVerification: process.env.MANUAL_VERIFICATION ?? "",
});
writeWorkflowOutput("publish_ref", refs?.cli ?? "");
writeWorkflowOutput("viewer_ref", refs?.viewer ?? "");
writeWorkflowOutput("verification", verification);
process.stdout.write(
  refs
    ? `Selected immutable releases ${refs.viewer}, ${refs.cli} with ${verification} verification.\n`
    : "No release artifact selected.\n",
);
