import type { ReactElement, ReactNode } from "react";

import type { ApiError } from "../api/errors";
import type { Build, Workspace, Project } from "../api/types";
import type { Resource } from "../data/use-resource";

import type { AccessState } from "./access";
import { buildStageView } from "./build-stage";
import type { BuildWatch } from "./build-watch";
import type { ViewerEntry } from "./entry";
import { ForkPullRequest } from "./fork-card";
import type { ViewerStatus } from "./host";
import { StagePublish, StagePublishReader } from "./publish-card";
import { stageStatus } from "./resolution";
import type { SourceState } from "./source-store";
import {
  AccessBlocked,
  AccessRefused,
  ClosedPullRequest,
  FailedPublication,
  PublishingOnTeam,
  SetUpPublishing,
  StageError,
  UnavailablePublication,
  UnpublishedPullRequest,
} from "./stage";
import { StageWait } from "./stage-card";
import { planRefusalFailure, unpublishedStage } from "./stage-view-decision";
import type { UnpublishedStage } from "./stage-view-decision";
import { VersionFailure } from "./version-failure";
import { workspaceRole } from "./workspace-role";

/** What the stage reports and what it draws for one resolved address. */
export interface StageView {
  status: ViewerStatus;
  message?: ReactNode;
}

/** What the reader can do about each state the stage can be in. */
export interface StageActions {
  onChoose: () => void;
  onRetryEntry: () => void;
  onRetryWorkspace: () => void;
  onRetryAccess: () => void;
  onOpenBilling: () => void;
  /** Repeat a first build read that failed. */
  onRetryBuild: () => void;
  /** Show the build a cancellation answered with. */
  onCancelled: (build: Build) => void;
  /** Reload the document at the same address, which loads the current viewer. */
  onReload: () => void;
}

/**
 * The workspace read failed for another reason than `not-found`. Whoever
 * reads the plan card may be an owner, so the card gives way to that read's
 * own Try again rather than guess which copy is theirs.
 */
function unreadableWorkspace(
  error: ApiError,
  actions: StageActions,
): StageView {
  return {
    status: "unavailable",
    message: (
      <StageError
        title="This workspace couldn’t load"
        error={error}
        onRetry={actions.onRetryWorkspace}
      />
    ),
  };
}

/**
 * The card an unpublished address draws once no read is still deciding it.
 * The return type excludes nothing-drawn, so a card the decision gains fails
 * to compile here until it is drawn.
 */
function unpublishedCard(
  stage: Exclude<
    UnpublishedStage,
    { kind: "pending-workspace" | "unreadable-workspace" }
  >,
  project: Project,
  actions: StageActions,
): ReactElement {
  switch (stage.kind) {
    case "pull-request":
      return <UnpublishedPullRequest onChoose={actions.onChoose} />;
    case "closed-pull-request":
      return (
        <ClosedPullRequest state={stage.state} onChoose={actions.onChoose} />
      );
    case "fork-pull-request":
      return <ForkPullRequest onChoose={actions.onChoose} />;
    case "publish":
      return <StagePublish project={project} reference={stage.reference} />;
    case "publish-reader":
      return (
        <StagePublishReader
          pullRequest={stage.pullRequest}
          onChoose={actions.onChoose}
        />
      );
    case "plan-required":
      return (
        <PublishingOnTeam
          canUpgrade={stage.canUpgrade}
          onOpenBilling={actions.onOpenBilling}
          onChoose={actions.onChoose}
        />
      );
    case "set-up":
      return <SetUpPublishing project={project} onChoose={actions.onChoose} />;
  }
}

/**
 * A ready publication: the access exchange, then the index read, then the
 * package. The index read shows the exchange's pending card, and a failed
 * read is a refusal another press can fix, because Try again repeats the
 * exchange and then the read. A version failure of the index or of a detail
 * replaces the package until a new source or a reload.
 */
function readyView(
  access: AccessState,
  catalogue: SourceState,
  actions: StageActions,
): StageView {
  const opening: StageView = {
    status: "loading",
    message: <StageWait label="Opening the catalogue" />,
  };
  if (access.status === "granting") return opening;
  if (access.status === "refused") {
    return {
      status: "unavailable",
      message: (
        <AccessRefused error={access.error} onRetry={actions.onRetryAccess} />
      ),
    };
  }
  if (access.status === "blocked") {
    return {
      status: "unavailable",
      message: <AccessBlocked />,
    };
  }
  if (catalogue.failure) {
    return {
      status: "unavailable",
      message: (
        <VersionFailure
          details={catalogue.failure.details}
          onReload={actions.onReload}
        />
      ),
    };
  }
  if (catalogue.read.status === "failed") {
    return {
      status: "unavailable",
      message: <AccessRefused onRetry={actions.onRetryAccess} />,
    };
  }
  return catalogue.read.status === "ready" ? { status: "ready" } : opening;
}

/**
 * What the stage shows for one resolved address. Only a ready, unexpired
 * publication the reader has already been let into reports `ready`; every other
 * state names itself in one card, so the stage never claims a catalogue it is
 * not showing.
 */
export function stageView(input: {
  entry: ViewerEntry;
  project: Project;
  /** Workspace ownership for the upgrade action when publishing is gated. */
  workspace: Resource<Workspace>;
  access: AccessState;
  /** The ready publication's catalogue source and where its index read stands. */
  catalogue: SourceState;
  isPullRequest: boolean;
  /** Whether the address named a publication; a standalone entry names none. */
  named: boolean;
  /** Whether the reader has member access, which builds are shown to. */
  member: boolean;
  /** The build the entry chose, as it has been read so far. */
  build: BuildWatch;
  actions: StageActions;
}): StageView {
  const { entry, project, workspace, access, actions } = input;
  if (entry.kind === "build") {
    const role = workspaceRole(workspace);
    const shown =
      input.build.status === "ready" ? input.build.build : undefined;
    const failure = planRefusalFailure(shown, role);
    if (failure) return unreadableWorkspace(failure, actions);
    return buildStageView({ watch: input.build, project, role, actions });
  }
  if (entry.kind === "loading" || entry.kind === "redirect") {
    return {
      status: "loading",
      message: <StageWait label="Loading publication" />,
    };
  }
  if (entry.kind === "error") {
    return {
      status: "unavailable",
      message: (
        <StageError
          title={
            input.named
              ? "This publication couldn’t load"
              : "This project couldn’t load"
          }
          error={entry.error}
          onRetry={actions.onRetryEntry}
        />
      ),
    };
  }
  if (entry.kind === "missing") {
    return {
      status: "unavailable",
      message: <UnavailablePublication onChoose={actions.onChoose} />,
    };
  }
  if (entry.kind === "unpublished") {
    const unpublished = unpublishedStage(
      project,
      workspace,
      input.isPullRequest,
      {
        reference: entry.reference,
        member: input.member,
        closed: entry.closed,
        fork: entry.fork,
      },
    );
    if (unpublished.kind === "pending-workspace") {
      return {
        status: "loading",
        message: <StageWait label="Checking publishing access" />,
      };
    }
    if (unpublished.kind === "unreadable-workspace") {
      return unreadableWorkspace(unpublished.error, actions);
    }
    return {
      status: "unpublished",
      message: unpublishedCard(unpublished, project, actions),
    };
  }
  const { publication } = entry;
  const status = stageStatus(publication);
  if (status === "loading") {
    return {
      status,
      message: <StageWait label="Publishing this branch" />,
    };
  }
  if (status === "unavailable") {
    return {
      status,
      message:
        publication.state === "failed" ? (
          <FailedPublication
            publication={publication}
            onChoose={actions.onChoose}
          />
        ) : (
          <UnavailablePublication onChoose={actions.onChoose} />
        ),
    };
  }
  return readyView(access, input.catalogue, actions);
}
