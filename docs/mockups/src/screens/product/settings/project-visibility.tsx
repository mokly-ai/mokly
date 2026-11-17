import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import { sample } from "../../../fixtures/product";
import { billing, failureReference } from "../../../fixtures/product-states";
import { Action } from "../page-parts";

import { SettingsModal } from "./settings-modal";

/** Who can open the project's publications. */
export type Visibility = "public" | "private";

/**
 * The visibility question over the Project pane. While its write runs, the
 * control that sent it is busy with its working word, the other decision
 * waits disabled, and screen readers hear the operation with the project's
 * name. A plan refusal stays inside this modal through the shared
 * write-failure composition, beside the control that made the request and
 * the role-specific way on.
 */
export function VisibilityModal({
  next,
  working = false,
  planRefused = false,
  role = "owner",
}: {
  /** The visibility that the question asks for. */
  next: Visibility;
  /** The change's own write is running. */
  working?: boolean;
  /** The free plan refused to make the project private. */
  planRefused?: boolean;
  role?: "owner" | "admin";
}) {
  const makingPrivate = next === "private";
  const controls = (
    <div className="review-inline">
      <Action
        label={
          working
            ? makingPrivate
              ? "Making private…"
              : "Making public…"
            : makingPrivate
              ? "Make private"
              : "Make public"
        }
        tone="primary"
        size="md"
        busy={working ? "Making " + sample.project + " " + next : undefined}
      />
      <Action
        label={makingPrivate ? "Keep public" : "Keep private"}
        tone="quiet"
        size="md"
        to="product/settings/project"
        disabled={working}
      />
      {planRefused && role === "owner" && (
        <Action label="Open billing" to="product/settings/billing" size="md" />
      )}
    </div>
  );
  return (
    <SettingsModal
      title={"Make " + sample.project + " " + next + "?"}
      instance="project-visibility"
    >
      <span className="fo-note-detail">
        {makingPrivate
          ? "Only project members will be able to open this project’s publications."
          : "Anyone with the link will be able to open this project’s publications."}
      </span>
      {planRefused ? (
        <WriteFailure
          moklyInstance="project-plan-failure"
          cause={billing.copy.privateVisibility}
          reference={failureReference}
          control={
            <>
              {controls}
              {role === "admin" && (
                <p className="fo-copy">{billing.copy.askOwner}</p>
              )}
            </>
          }
        />
      ) : (
        controls
      )}
    </SettingsModal>
  );
}
