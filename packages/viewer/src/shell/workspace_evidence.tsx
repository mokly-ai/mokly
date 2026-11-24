/**
 * Factual comparison evidence of a screen or a component, in the right
 * panel: in its Changes tab, or in Inspect while it has no Changes tab. This
 * container projects the evidence, words each reason, and decides which
 * facts show. `@mokly/ui/comparison-evidence` renders them in the designs'
 * order.
 */

import { ComparisonEvidence } from "@mokly/ui/comparison-evidence";

import { isComponentVariant } from "../catalogue/variants.js";
import { decodeProps } from "../components/codec.js";
import { viewHref } from "../navigation/routes.js";

import { entryWording } from "./entry_wording.js";
import { stylesheetDetails } from "./evidence_details.js";
import { reasonSentences } from "./reason_sentences.js";
import type { WorkspaceData } from "./workspace_data.js";
import { workspaceComparisonEvidence } from "./workspace_evidence_data.js";
import { propText } from "./workspace_props.js";

/**
 * Comparison facts for the current entry and, once a comparison loads, its
 * compared views, in the designs' order: the branch point, the outcome line
 * of each compared frame and, for a moved entry, the path its
 * earlier side comes from; one sentence per reason; the changed and excluded
 * stylesheets; the paired prop values; then the changed components used here.
 * An entry that only changed components affect ends with their explanation in
 * place of the no-changes line.
 */
export function WorkspaceEvidence({
  base,
  compared = false,
  data,
  outcomes,
  previousPath,
  variantPath,
}: {
  /**
   * The branch point's name that the details give, the index's by default.
   * The Changes tab gives an empty name, because its Compared rail names the
   * branch point in place of the details' sentence.
   */
  base?: string;
  /** A comparison of the routed entry is loaded. */
  compared?: boolean;
  data: WorkspaceData;
  /** The outcome line of each compared frame, which the Changes tab lists. */
  outcomes?: readonly string[];
  previousPath?: string;
  variantPath?: string;
}) {
  const evidence = workspaceComparisonEvidence(data, compared);
  const hidden = data.status === undefined && !evidence.comparison;
  const branchPoint = base ?? data.base;
  if (hidden)
    return (
      <ComparisonEvidence
        base={branchPoint}
        hidden
        mark="data-workspace-evidence"
      />
    );
  const wording = entryWording(data.entry.kind);
  const savedView = data.variants.find(
    (item) => item.value.path === variantPath,
  );
  const savedProps = evidence.comparison?.savedProps;
  const savedPropsChanged =
    savedProps !== undefined &&
    JSON.stringify(savedProps.before) !== JSON.stringify(savedProps.after);
  return (
    <ComparisonEvidence
      base={branchPoint}
      changedComponents={data.relatedComponents.map((component) => ({
        href: viewHref(component.path),
        key: component.path,
        title: component.title,
      }))}
      hidden={false}
      ignored={evidence.ignoredIds}
      inputChanges={data.inputChanges
        .filter((item) => item.variantPath === variantPath)
        .map((change) => ({
          after: propText(decodeProps(change.after)),
          before: propText(decodeProps(change.before)),
          colorScheme: change.colorScheme,
          instanceId: change.instanceId,
          key: `${change.instanceId}/${change.viewport}/${change.colorScheme}`,
          title: change.title,
          viewport: change.viewport,
        }))}
      mark="data-workspace-evidence"
      noChanges={
        !evidence.sharedImpact &&
        data.status === "Unmodified" &&
        (savedView?.status ?? "Unmodified") === "Unmodified"
          ? wording.noChanges
          : undefined
      }
      outcomes={outcomes}
      previousPath={previousPath}
      reasons={reasonSentences(evidence.reasons)}
      savedProps={
        savedProps && savedPropsChanged
          ? {
              after: propText(decodeProps(savedProps.after)),
              before: propText(decodeProps(savedProps.before)),
            }
          : undefined
      }
      savedVariant={
        data.entry.kind === "component" && isComponentVariant(data.entry)
          ? {
              savedPropsUnchanged:
                savedProps !== undefined && !savedPropsChanged,
              title: data.entry.title,
            }
          : undefined
      }
      sharedImpact={evidence.sharedImpact ? wording.sharedImpact : undefined}
      {...stylesheetDetails(
        evidence.reasons,
        evidence.resourceViews,
        data.entry.kind === "component"
          ? { kind: "component", componentId: evidence.componentId }
          : { kind: "screen" },
      )}
    />
  );
}
