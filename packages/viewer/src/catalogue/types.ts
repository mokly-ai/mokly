/** Public read model v8, entry detail v2 and live descriptor v3 shapes. */

import type { CatalogueComponent } from "../generated/catalogue/CatalogueComponent.js";
import type { CatalogueScreen } from "../generated/catalogue/CatalogueScreen.js";
import type { RemovedPreview } from "../generated/catalogue/RemovedPreview.js";

export type { CatalogueChanges } from "../generated/catalogue/CatalogueChanges.js";
export type { CatalogueComponent } from "../generated/catalogue/CatalogueComponent.js";
export type { CatalogueDetails } from "../generated/catalogue/CatalogueDetails.js";
export type { CatalogueDocument } from "../generated/catalogue/CatalogueDocument.js";
export type { CatalogueIdentity } from "../generated/catalogue/CatalogueIdentity.js";
export type { CatalogueNode } from "../generated/catalogue/CatalogueNode.js";
export type { CataloguePage } from "../generated/catalogue/CataloguePage.js";
export type { CatalogueReadModel } from "../generated/catalogue/CatalogueReadModel.js";
export type { CatalogueRecord } from "../generated/catalogue/CatalogueRecord.js";
export type { CatalogueScreen } from "../generated/catalogue/CatalogueScreen.js";
export type { CatalogueUsage } from "../generated/catalogue/CatalogueUsage.js";
export type { CatalogueUseCase } from "../generated/catalogue/CatalogueUseCase.js";
export type { CatalogueView } from "../generated/catalogue/CatalogueView.js";
export type { ChangeKind } from "../generated/catalogue/ChangeKind.js";
export type { ChangesStatus } from "../generated/catalogue/ChangesStatus.js";
export type { ComparisonSelection } from "../generated/catalogue/ComparisonSelection.js";
export type { DetailEntry } from "../generated/catalogue/DetailEntry.js";
export type { DetailView } from "../generated/catalogue/DetailView.js";
export type { DocumentKey } from "../generated/catalogue/DocumentKey.js";
export type { EntryDetailV2 } from "../generated/catalogue/EntryDetailV2.js";
export type { EntryKind } from "../generated/catalogue/EntryKind.js";
export type { EvidenceOwner } from "../generated/catalogue/EvidenceOwner.js";
export type { InputChange } from "../generated/catalogue/InputChange.js";
export type { LiveDescriptorV3 } from "../generated/catalogue/LiveDescriptorV3.js";
export type { LiveGeneration } from "../generated/catalogue/LiveGeneration.js";
export type { RelatedComponent } from "../generated/catalogue/RelatedComponent.js";
export type { RemovedEntry } from "../generated/catalogue/RemovedEntry.js";
export type { RenderCapability } from "../generated/catalogue/RenderCapability.js";
export type { ResourceEvidence } from "../generated/catalogue/ResourceEvidence.js";
export type { ReviewEntryAddress } from "../generated/catalogue/ReviewEntryAddress.js";
export type { ReviewState } from "../generated/catalogue/ReviewState.js";
export type { RuleEvidence } from "../generated/catalogue/RuleEvidence.js";
export type { RuleStatus } from "../generated/catalogue/RuleStatus.js";
export type { UsageLink } from "../generated/catalogue/UsageLink.js";
export type { UseCaseStep } from "../generated/catalogue/UseCaseStep.js";
export type { ViewEvidence } from "../generated/catalogue/ViewEvidence.js";
export type { Workspace } from "../generated/catalogue/Workspace.js";

/** An artifact-root-relative POSIX file path without a leading slash. */
export type PublicPath = string;
/** The historical preview kind a removed record advertises. */
export type RemovedEntryPreview = RemovedPreview;
/** A component entry that varies its parent's props. */
export type CatalogueComponentVariant = CatalogueComponent & {
  variantOf: string;
};
/** The identity and display metadata every current or removed entry carries. */
export type CatalogueEntry = Pick<
  CatalogueScreen,
  "path" | "previousPath" | "title" | "tags" | "details" | "changes"
>;
