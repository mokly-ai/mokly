import {
  MetadataChips,
  MetadataCode,
} from "../../../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { MetaRow } from "../../../parts/metadata_row.js";
import { COMPONENT_IDENTITIES } from "../../parts/component_identity.js";
import { ChooseVariant } from "../../parts/component_props.js";
import { CANVAS_ENTRIES } from "../../parts/entries.js";
import {
  InspectFold,
  InspectFrames,
  InspectHead,
  InspectSelection,
} from "../../parts/inspect.js";
import { ActionUsage } from "../../parts/inspect_folds.js";
import { ComponentHead, SET_FILTER } from "../../parts/inspect_sets.js";
import { InspectVariants } from "../../parts/inspect_variants.js";

import { EVIDENCE_ENTRIES } from "./branches.js";
import { ACTION_EXCLUDED_STYLES } from "./evidence.js";
import { InspectEvidence } from "./inspect.js";

/**
 * Inspect for the unmodified Action on its stylesheet branch, as its variant
 * set: its head, the evidence of its examined stylesheet in the words of a
 * variant, its variants and frames, and Props, which asks for a variant. No
 * artboard of this branch shows a variant chosen, so the variants are
 * pictures. A leaf renders no registered component, so Highlight components
 * is unavailable and the set has no component tree.
 */
export function ActionExcludedInspect() {
  return (
    <>
      <ComponentHead
        component={COMPONENT_IDENTITIES.action}
        entry={CANVAS_ENTRIES.action}
      />
      <InspectEvidence facts={ACTION_EXCLUDED_STYLES} />
      <InspectVariants
        variants={[
          { label: "Default" },
          { label: "Disabled" },
          { label: "Secondary" },
        ]}
      />
      <InspectFrames
        count={6}
        filter={{ ...SET_FILTER, unavailable: "empty" }}
      />
      <InspectSelection />
      <InspectFold name="props" title="Props">
        <ChooseVariant />
      </InspectFold>
      <InspectFold count={3} name="usage" title="Usage">
        <ActionUsage />
      </InspectFold>
    </>
  );
}

/**
 * Inspect for the Getting started page: a document's Inspect holds its head
 * alone, with its change status beside its title. Its related document is
 * named as text, because Canvas links stay inside the Canvas family.
 */
export function PageInspect() {
  return (
    <InspectHead
      description="A handbook to accompany the example screens."
      entry={EVIDENCE_ENTRIES.page}
      rows={
        <>
          <MetaRow name="tags" label="Tags">
            documents
          </MetaRow>
          <MetaRow name="related-docs" label="Related docs">
            <MetadataChips>
              <MetadataCode>Example notes</MetadataCode>
            </MetadataChips>
          </MetaRow>
        </>
      }
      source="specs/catalogue.tsx"
    />
  );
}
