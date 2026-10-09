import type {
  ChangedEntry,
  ComponentReview,
  Manifest,
  ScreenReviewV7,
} from "@mokly/viewer/data";

import { relatedDocumentReferences } from "../documents/references.js";

import { affectedConsumers } from "./component_affected.js";
import {
  propagateImplementations,
  propagateUseCases,
} from "./component_change_propagation.js";
import type { ComponentClassificationInput } from "./component_classification_input.js";
import type { ComponentClassificationWithSources } from "./component_classification_sources.js";
import { lexical, type entryPairs } from "./component_metadata.js";
import type { ComponentReasonSources } from "./component_reason_sources.js";
import {
  propagateOwnedResources,
  type OwnedResourceReason,
} from "./component_resource_attribution.js";
import { pairedEntryChanges } from "./entry_changes.js";
import { baselinePathMapper } from "./moves/identity.js";
import type { MovePairing } from "./moves/types.js";
import { aggregateIgnored } from "./screen_views.js";

/** Finish one classified generation without changing its paired source identities. */
export function finishComponentClassification(input: {
  request: ComponentClassificationInput;
  before: Manifest;
  after: Manifest;
  pairs: ReturnType<typeof entryPairs>;
  pairing: MovePairing;
  screens: ScreenReviewV7[];
  components: ComponentReview[];
  changes: ChangedEntry[];
  ownedResources: OwnedResourceReason[];
  impacting: Set<string>;
  actualImplementations: Set<string>;
  reasonSources: ComponentReasonSources;
}): ComponentClassificationWithSources {
  const {
    request,
    before,
    after,
    pairs,
    pairing,
    screens,
    components,
    changes,
    ownedResources,
    impacting,
    actualImplementations,
    reasonSources,
  } = input;
  propagateOwnedResources(ownedResources, impacting, components, changes);
  reasonSources.recordOwnedResources(
    ownedResources,
    pairs.map((pair) => (pair.after ?? pair.before)!),
  );
  propagateImplementations(
    actualImplementations,
    impacting,
    components,
    changes,
  );
  propagateUseCases(
    pairs,
    before,
    after,
    changes,
    baselinePathMapper(before.entries, after.entries, pairing.moves),
  );
  screens.sort((a, b) => lexical(a.path, b.path));
  components.sort((a, b) => lexical(a.path, b.path));
  changes.splice(
    0,
    changes.length,
    ...pairedEntryChanges(
      changes,
      pairs,
      baselinePathMapper(before.entries, after.entries, pairing.moves),
      relatedDocumentReferences(
        before.entries,
        baselinePathMapper(before.entries, after.entries, pairing.moves),
      ),
      relatedDocumentReferences(after.entries),
    ),
  );
  changes.sort(
    (a, b) =>
      lexical(a.kind, b.kind) ||
      lexical((a.after ?? a.before)!.path, (b.after ?? b.before)!.path),
  );
  return {
    result: {
      schemaVersion: 7,
      baseCommit: request.baseCommit,
      baseRef: request.baseRef,
      changedPaths: [...request.changedPaths].sort(),
      screens,
      components,
      changes,
      affectedConsumers: affectedConsumers(
        before,
        after,
        impacting,
        pairing.moves,
      ),
      ignoredImpact: aggregateIgnored(screens),
    },
    implementationImpact: impacting,
    sources: reasonSources,
    pairing,
  };
}
