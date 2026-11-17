import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { Build, Project } from "../api/types";
import { Action } from "../components/action";
import { Icon } from "../components/icons";
import { ExternalLink, Pending } from "../components/page-parts";
import { ControlPlaceholder } from "../components/placeholders";
import { PlanConsequence } from "../components/plan-consequence";
import { site } from "../config";
import { cancelBuild } from "../data/builds";
import { buildPath, publicationPath } from "../navigation/paths";
import { alwaysSendable, nothingToDo, useWrite } from "../settings/write";
import { awaitsOwnerAction, buildAction } from "./build-action";
import type { BuildAction } from "./build-action";
import {
  buildCardLabels,
  buildLine,
  buildTitle,
  cancellingOperation,
  publishFromCiLabel,
  publishingLabel,
  publishingOperation,
} from "./build-copy";
import type { LogView } from "./build-log";
import { BuildOutput, BuildSteps } from "./build-output";
import { useBuildRequest } from "./build-request";
import {
  buildFailed,
  buildReference,
  buildReferenceLabel,
} from "./build-state";
import { ControlWithGuide } from "./control-guide";
import type { WorkspaceRole } from "./workspace-role";
import { refusedLabel } from "./request-controls";
import { shortSha } from "./resolution";

/** Everything one build's card needs; every value comes from the API. */
export interface BuildCardProps {
  project: Project;
  build: Build;
  log: LogView;
  /** Whether the reader owns the workspace, which decides a plan refusal. */
  role: WorkspaceRole;
  /** Show the build a cancellation answered with. */
  onCancelled: (build: Build) => void;
  onOpenBilling: () => void;
}

/** A sentence whose backticked words are code, as the contract writes them. */
function Sentence({ text }: { text: string }) {
  return (
    <>
      {text
        .split("`")
        .map((part, index) =>
          index % 2 === 1 ? <code key={index}>{part}</code> : part,
        )}
    </>
  );
}

/**
 * Cancel stays secondary, because a running build moves forward on its own.
 * While its request runs, it is busy with Cancelling… and keeps its focus.
 * The cancellation's answer is shown at once rather than at the next poll. A
 * refused or failed Cancel reports its cause above the control and still
 * reads Cancel, even where the same request could succeed, because Try again
 * on a build card requests a new build.
 */
function CancelBuild({
  project,
  build,
  onCancelled,
}: Pick<BuildCardProps, "project" | "build" | "onCancelled">) {
  const cancel = useWrite(nothingToDo, alwaysSendable);
  return cancel.around(
    <Action
      label={cancel.label(
        buildCardLabels.cancel,
        buildCardLabels.cancelling,
        refusedLabel("cancel", buildCardLabels.cancel),
      )}
      tone="secondary"
      size="md"
      write={cancel}
      operation={cancellingOperation}
      disabled={cancel.disabled}
      onPress={() =>
        void cancel.run(async () =>
          onCancelled(await cancelBuild(project.id, build.id)),
        )
      }
      testID="build-cancel"
    />,
  );
}

/**
 * Publish the same reference again. While the request runs, the control is
 * busy with Publishing… and keeps its focus. A refusal is reported through
 * the write-failure fragment: the refusal above the control and Details
 * beneath. The control is the shared control with guide, and this card offers
 * it no guide: a refusal never adds one, so the control stands alone between
 * the refusal and Details.
 */
function TryAgain({
  project,
  build,
}: Pick<BuildCardProps, "project" | "build">) {
  const reference = buildReference(build);
  const { write, send } = useBuildRequest(project, reference);
  return write.around(
    <ControlWithGuide
      control={
        <Action
          label={write.label(
            buildCardLabels.tryAgain,
            publishingLabel,
            refusedLabel("try-again", buildCardLabels.tryAgain),
          )}
          tone="primary"
          size="md"
          icon="retry"
          write={write}
          operation={publishingOperation[reference.kind]}
          disabled={write.disabled}
          onPress={send}
          testID="build-try-again"
        />
      }
    />,
  );
}

/**
 * The control that draws one action the card offers. Publish from CI is a
 * link, like every other control that offers the CI setup guide.
 */
function ActionControl({
  action,
  ...props
}: BuildCardProps & { action: BuildAction }) {
  const { workspaceSlug, slug } = props.project;
  switch (action.kind) {
    case "cancel":
      return <CancelBuild {...props} />;
    case "open-catalogue": {
      const target = publicationPath(workspaceSlug, slug, action.publicationId);
      return (
        <Action
          label={buildCardLabels.openCatalogue}
          tone="primary"
          size="md"
          href={action.changes ? target + "?view=changes" : target}
          testID="build-open-catalogue"
        />
      );
    }
    case "open-newer":
      return (
        <Action
          label={buildCardLabels.openNewer}
          tone="primary"
          size="md"
          href={buildPath(workspaceSlug, slug, action.buildId)}
          testID="build-open-newer"
        />
      );
    case "open-billing":
      return (
        <PlanConsequence
          canUpgrade
          onOpenBilling={props.onOpenBilling}
          tone="primary"
          size="md"
          testID="build-open-billing"
        />
      );
    case "publish-from-ci":
      return (
        <ExternalLink to={site.publishFromCi} label={publishFromCiLabel} />
      );
    case "try-again":
      return <TryAgain {...props} />;
  }
}

/** The width of Open billing at the card's action size, in px. */
const openBillingWidth = 110;

/**
 * The owner's action while the workspace read decides who the reader is: its
 * placeholder in the action's own place, because the plan refusal offers an
 * owner Open billing. The owner's card has no line, and no text place on it
 * is the read's, so the read is named for screen readers only.
 */
function OwnerActionWait() {
  return (
    <Pending label="Checking publishing access" labelMode="screen-reader-only">
      <ControlPlaceholder size="md" width={openBillingWidth} />
    </Pending>
  );
}

/**
 * One build in the stage: its state as the title, the reference it publishes
 * with the short head SHA, an optional line, at most one action, the three
 * steps and the output. A failure announces its title and line, because the
 * reader may be watching it happen; the reference and the action stay outside
 * that alert, so a control that changes its label or reports a refusal never
 * repeats it. After Cancel succeeds, focus moves to the title and a polite
 * status says it, because the control the reader pressed is gone. The status
 * reads the title the card shows, so the two never disagree.
 */
export function BuildCard(props: BuildCardProps) {
  const { build, log, onCancelled } = props;
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  /** The build a Cancel was answered for, each time one was. */
  const [cancelled, setCancelled] = useState<{ id: string }>();
  const cancel = useCallback(
    (next: Build) => {
      onCancelled(next);
      setCancelled({ id: next.id });
    },
    [onCancelled],
  );
  useEffect(() => {
    if (cancelled) title.current?.focus();
  }, [cancelled]);
  const line = buildLine(build, props.role);
  const action = buildAction(build, props.project, props.role);
  return (
    <section
      className="fo-build"
      aria-labelledby={titleId}
      data-mkc-build-state={build.state}
    >
      <div className="fo-build-head">
        <div className="fo-build-summary">
          <div
            className="fo-build-message"
            role={buildFailed(build.state) ? "alert" : undefined}
          >
            <h2
              className="fo-state-title"
              id={titleId}
              ref={title}
              tabIndex={-1}
            >
              {buildTitle(build)}
            </h2>
            {line && (
              <p className="fo-build-line">
                <Sentence text={line.text} />
              </p>
            )}
          </div>
          <p className="fo-build-reference">
            <Icon
              name={build.pullRequest ? "pullRequest" : "branch"}
              size={13}
            />
            <span className="fo-build-reference-name">
              {buildReferenceLabel(build)}
            </span>
            <code className="mono-value">{shortSha(build.headSha)}</code>
          </p>
        </div>
        {action ? (
          <div className="fo-build-action">
            <ActionControl {...props} onCancelled={cancel} action={action} />
          </div>
        ) : (
          awaitsOwnerAction(build, props.role) && (
            <div className="fo-build-action">
              <OwnerActionWait />
            </div>
          )
        )}
      </div>
      <BuildSteps build={build} />
      <BuildOutput log={log} />
      <p className="fo-sr-only" role="status">
        {cancelled?.id === build.id ? buildTitle(build) : undefined}
      </p>
    </section>
  );
}
