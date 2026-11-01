import { mockLink } from "@mokly/mokly";

import {
  ComparisonEvidence,
  type EvidenceInputChange,
} from "../../../../../../packages/ui/src/comparison-evidence/comparison-evidence.js";
import { useDesignInstance } from "../../library/composition.js";
import { changeStatusBadge } from "../../library/controls/change-status.js";
import { reasonEvidence } from "../../parts/reason_sentences.js";
import {
  COMPONENT_STYLE_COPY,
  SCREEN_STYLE_COPY,
} from "../../parts/stylesheet_evidence.js";

import type { ChangeStatus, ComparisonFixture } from "./comparison_fixtures.js";

export function ChangeStatusBadge({ status }: { status: ChangeStatus }) {
  return (
    <changeStatusBadge.Component
      moklyInstance={useDesignInstance("status")}
      status={status}
    />
  );
}

/** The paired props of a changed instance in each light view, as the shell writes them. */
function inputChanges(
  change: NonNullable<
    Extract<ComparisonFixture, { reasons: unknown }>["propChange"]
  >,
): EvidenceInputChange[] {
  const props = (value: string) =>
    `{${JSON.stringify(change.prop)}: ${JSON.stringify(value)}, "disabled": false}`;
  return (["desktop", "mobile"] as const).map((viewport) => ({
    after: props(change.after),
    before: props(change.before),
    colorScheme: "light",
    instanceId: change.instanceId,
    key: `${change.instanceId}/${viewport}/light`,
    title: change.title,
    viewport,
  }));
}

/**
 * Factual evidence belongs to the inspector, with no generated visual
 * narrative, in the shipped evidence: each direct reason reads as one sentence
 * after the branch point, then the saved variant, the files, the paired props,
 * and the changed components. An ordinary Unmodified entry has no comparison,
 * so it shows no section.
 */
export function ComparisonDetails({
  comparison,
  subject,
}: {
  comparison?: ComparisonFixture | undefined;
  /** Whose evidence this is, which selects the stylesheet copy. */
  subject: "component" | "screen";
}) {
  if (!comparison) return null;
  const detail = comparison.status === "unmodified" ? undefined : comparison;
  const affected = "affected" in comparison ? comparison : undefined;
  const excluded =
    "excludedStylesheets" in comparison
      ? comparison.excludedStylesheets
      : undefined;
  const stylesheets = detail?.stylesheets ?? affected?.stylesheets;
  const changedComponents =
    detail?.changedComponents ?? affected?.changedComponents;
  const styleCopy =
    subject === "component" ? COMPONENT_STYLE_COPY : SCREEN_STYLE_COPY;
  return (
    <ComparisonEvidence
      base="origin/main"
      changedComponents={changedComponents?.map((component) => ({
        href: mockLink(component.to),
        key: component.to,
        title: component.title,
      }))}
      excluded={
        excluded
          ? { paths: excluded, sentence: COMPONENT_STYLE_COPY.excluded }
          : undefined
      }
      files={stylesheets ? { lead: styleCopy.files, stylesheets } : undefined}
      inputChanges={
        detail?.propChange ? inputChanges(detail.propChange) : undefined
      }
      mark="data-workspace-evidence"
      noChanges={excluded ? COMPONENT_STYLE_COPY.noChanges : undefined}
      reasons={detail ? reasonEvidence(detail.reasons) : undefined}
      savedVariant={
        detail?.variant
          ? {
              savedPropsUnchanged: detail.savedPropsUnchanged === true,
              title: detail.variant,
            }
          : undefined
      }
      sharedImpact={affected ? styleCopy.sharedImpact : undefined}
    />
  );
}
