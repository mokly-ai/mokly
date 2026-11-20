import { resolvePublishRefs, writeWorkflowOutput } from "./context.mjs";

const eventName = process.env.RELEASE_EVENT ?? "";
const refs = resolvePublishRefs({
  eventName,
  manualRef: process.env.MANUAL_REF ?? "",
  releaseCreated: process.env.RELEASE_CREATED ?? "",
  releaseTag: process.env.RELEASE_TAG ?? "",
});
writeWorkflowOutput("publish_ref", refs?.cli ?? "");
process.stdout.write(
  refs
    ? `Selected ${refs.cli} with ${refs.viewer} and evidence verification.\n`
    : "No release artifact selected.\n",
);
