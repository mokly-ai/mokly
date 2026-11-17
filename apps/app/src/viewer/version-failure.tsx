import { Action } from "../components/action";
import { ErrorDetails } from "../components/error-details";
import { StateMessage } from "../components/page-parts";

import { StageCard } from "./stage-card";

/**
 * The named upstream copy exception inside the cloud's existing stage card:
 * the package's one headline with no supporting sentence, its plain
 * diagnostic in a closed Details, and Reload, which loads the app's current
 * viewer.
 */
export function VersionFailure({
  details,
  onReload,
}: {
  details?: string;
  onReload: () => void;
}) {
  return (
    <StageCard>
      <StateMessage
        title="This catalogue needs a compatible viewer"
        error
        testID="viewer-version-failure"
        details={<ErrorDetails details={details} />}
        action={
          <Action
            label="Reload"
            tone="primary"
            size="md"
            icon="retry"
            onPress={onReload}
            testID="viewer-reload"
          />
        }
      />
    </StageCard>
  );
}
