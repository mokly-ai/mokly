import type { ReactNode } from "react";

import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import { requestOperations } from "../../../fixtures/build-copy";
import { failureReference } from "../../../fixtures/product-states";
import { Action } from "../page-parts";

import { ControlWithGuide } from "./control-guide";

/**
 * A request the card's control sent and the API refused, as the card reports
 * it beside that control: Cancel, or Try again's request for a new build.
 */
export interface BuildRefusal {
  /** What the refusal says, immediately above the control. */
  cause: string;
  /**
   * Whether the same request could succeed, so pressing the control again
   * leads where it leads at rest; otherwise it leads nowhere new. Either way
   * the control keeps its own label: Try again already reads Try again, and
   * Cancel keeps Cancel, because Try again on a build card requests a new
   * build.
   */
  retry: boolean;
}

/**
 * What the card's control shows after a press: the refusal its request was
 * answered with, or, while the request runs, its Write in progress. A control
 * nobody pressed is at rest.
 */
export type BuildPress =
  | { refusal?: BuildRefusal; busy?: undefined }
  | { refusal?: undefined; busy: true };

/**
 * A refused request through the write-failure fragment: the refusal above
 * the control and the reference Mokly answered with beneath.
 */
function Refused({
  refusal,
  control,
}: {
  refusal: BuildRefusal;
  control: ReactNode;
}) {
  return (
    <WriteFailure
      moklyInstance="build-refusal"
      cause={refusal.cause}
      reference={failureReference}
      control={control}
    />
  );
}

/**
 * Cancel stays secondary, because a running build moves forward on its own.
 * A refused Cancel keeps its label even where the same request could
 * succeed, as Mokly being busy can, because Try again on a build card
 * requests a new build. While its request runs, it reads Cancelling… and
 * leads nowhere.
 */
export function CancelBuild({ refusal, busy }: BuildPress) {
  const control = (
    <Action
      instance="build-cancel"
      label={busy ? "Cancelling…" : "Cancel"}
      to={
        refusal === undefined || refusal.retry
          ? "product/viewer/standalone/build/superseded/cancelled"
          : undefined
      }
      tone="secondary"
      size="md"
      busy={busy ? requestOperations.cancel : undefined}
    />
  );
  return refusal ? <Refused refusal={refusal} control={control} /> : control;
}

/**
 * Try again publishes the same reference again, and reads Publishing… while
 * that request runs. A refused one is the shared control with guide, which a
 * refusal never gives a guide, so it stands alone between the refusal and
 * Details.
 */
export function TryAgain({
  refusal,
  busy,
  reference,
}: BuildPress & { reference: "branch" | "pull-request" }) {
  const control = (
    <Action
      instance="build-try-again"
      label={busy ? "Publishing…" : "Try again"}
      to={
        refusal === undefined || refusal.retry
          ? "product/viewer/standalone/build/empty"
          : undefined
      }
      tone="primary"
      size="md"
      icon="retry"
      busy={busy ? requestOperations[reference] : undefined}
    />
  );
  return refusal ? (
    <Refused
      refusal={refusal}
      control={<ControlWithGuide control={control} />}
    />
  ) : (
    control
  );
}
