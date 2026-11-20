import { StateMessage } from "../components/page-parts";

import { ChooseAnother } from "./stage";
import { StageCard } from "./stage-card";

/**
 * An open pull request from a fork, with nothing published. No build runs for
 * a fork, so the card names the fact and says what the reader can do instead,
 * beside the switcher. It offers no way to publish, nobody to ask and no CI
 * guide, because Mokly's CI guide gives a fork's pull request no upload
 * credentials either.
 */
export function ForkPullRequest({ onChoose }: { onChoose: () => void }) {
  return (
    <StageCard>
      <StateMessage
        title="This pull request is from a fork"
        icon="pullRequest"
        action={<ChooseAnother onChoose={onChoose} />}
      >
        Review this pull request’s screens locally.
      </StateMessage>
    </StageCard>
  );
}
