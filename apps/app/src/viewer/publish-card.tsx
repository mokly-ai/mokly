import type { Project } from "../api/types";
import { Action } from "../components/action";
import { ExternalLink, StateMessage } from "../components/page-parts";
import { site } from "../config";
import type { PublicationRef } from "../data/publications";

import {
  publishCardCopy,
  publishFromCiLabel,
  publishingLabel,
  publishingOperation,
} from "./build-copy";
import { useBuildRequest } from "./build-request";
import { ControlWithGuide } from "./control-guide";
import { refusedLabel } from "./request-controls";
import { ChooseAnother } from "./stage";
import { StageCard } from "./stage-card";

/**
 * A reference with nothing published, read by someone who can publish it in a
 * project that can build: one press starts the build that publishes it, and
 * the CI setup guide stays beside it as the other way. While the request
 * runs, the control is busy with Publishing… and keeps its focus. Both are one
 * control with its guide, so a refused request puts the whole fragment between
 * the refusal and the reference Mokly answered with, and the guide stays above
 * Details.
 */
export function StagePublish({
  project,
  reference,
}: {
  project: Project;
  reference: PublicationRef;
}) {
  const branch = reference.kind === "branch";
  const { write, send } = useBuildRequest(project, reference);
  const copy = branch ? publishCardCopy.branch : publishCardCopy.pullRequest;
  return (
    <StageCard>
      <StateMessage
        title={copy.title}
        icon={branch ? "branch" : "pullRequest"}
        action={write.around(
          <ControlWithGuide
            control={
              <Action
                label={write.label(
                  copy.publish,
                  publishingLabel,
                  refusedLabel("publish", copy.publish),
                )}
                tone="primary"
                size="md"
                write={write}
                operation={publishingOperation[reference.kind]}
                disabled={write.disabled}
                onPress={send}
                testID="stage-publish"
              />
            }
            guide={
              <ExternalLink
                to={site.publishFromCi}
                label={publishFromCiLabel}
              />
            }
          />,
        )}
      />
    </StageCard>
  );
}

/**
 * The same reference read by a reviewer, who cannot request a build: the card
 * says who can and offers the switcher instead of a control they lack.
 */
export function StagePublishReader({
  pullRequest,
  onChoose,
}: {
  pullRequest: boolean;
  onChoose: () => void;
}) {
  const copy = pullRequest
    ? publishCardCopy.pullRequest
    : publishCardCopy.branch;
  return (
    <StageCard>
      <StateMessage
        title={copy.title}
        icon={pullRequest ? "pullRequest" : "branch"}
        action={<ChooseAnother onChoose={onChoose} />}
      >
        {copy.askToPublish}
      </StateMessage>
    </StageCard>
  );
}
