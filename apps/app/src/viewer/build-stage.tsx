import type { ApiError } from "../api/errors";
import type { Build, Project } from "../api/types";
import { ErrorDetails } from "../components/error-details";
import { StateMessage } from "../components/page-parts";
import { BuildCard } from "./build-card";
import { buildStageCopy } from "./build-copy";
import type { BuildWatch } from "./build-watch";
import type { WorkspaceRole } from "./workspace-role";
import { ChooseAnother, StageError } from "./stage";
import { StageCard, StageWait } from "./stage-card";
import type { StageView } from "./stage-view";

/** What the reader can do about a build the stage shows. */
export interface BuildStageActions {
  onChoose: () => void;
  /** Repeat a first build read that failed. */
  onRetryBuild: () => void;
  onCancelled: (build: Build) => void;
  onOpenBilling: () => void;
}

/**
 * An unknown build, one on another project or one this reader may not see.
 * The switcher is the way on, exactly as for an unavailable publication.
 */
function BuildUnavailable({
  error,
  onChoose,
}: {
  error: ApiError;
  onChoose: () => void;
}) {
  return (
    <StageCard>
      <StateMessage
        title={buildStageCopy.unavailable}
        error
        details={<ErrorDetails reference={error.requestId} />}
        action={<ChooseAnother onChoose={onChoose} />}
      />
    </StageCard>
  );
}

/**
 * The stage for a build: read, then its card. No catalogue mounts, so a found
 * build reports `unpublished` with its card as the stage message. A first read
 * that failed for another reason than `not-found` says only that reading it
 * failed, with reading it again as the one thing on offer.
 */
export function buildStageView(input: {
  watch: BuildWatch;
  project: Project;
  /** Whether the reader owns the workspace, which decides a plan refusal. */
  role: WorkspaceRole;
  actions: BuildStageActions;
}): StageView {
  const { watch, actions } = input;
  if (watch.status === "missing") {
    return {
      status: "unavailable",
      message: (
        <BuildUnavailable error={watch.error} onChoose={actions.onChoose} />
      ),
    };
  }
  if (watch.status === "error") {
    return {
      status: "unavailable",
      message: (
        <StageError
          title={buildStageCopy.unreadable}
          error={watch.error}
          onRetry={actions.onRetryBuild}
        />
      ),
    };
  }
  if (watch.status !== "ready") {
    return {
      status: "loading",
      message: <StageWait label={buildStageCopy.loading} />,
    };
  }
  return {
    status: "unpublished",
    message: (
      <StageCard>
        <BuildCard
          project={input.project}
          build={watch.build}
          log={watch.log}
          role={input.role}
          onCancelled={actions.onCancelled}
          onOpenBilling={actions.onOpenBilling}
        />
      </StageCard>
    ),
  };
}
