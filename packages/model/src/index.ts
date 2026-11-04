/** Shared catalogue rules and generated Rust model types. */

export {
  currentDocumentPath,
  currentDocumentRoute,
  RENDER_ID,
  RENDERS_PATH,
} from "./catalogue/delivery_paths.js";
export { encodeUrlPath, isSafeCatalogueRoute } from "./data/paths.js";
export {
  GENERATED_DIRECTORY,
  VIEWER_DIRECTORY,
} from "./generated/catalogue/Namespace.js";
export {
  firstPathCaseCollision,
  isEntryPath,
  isKebabCase,
  isLinkPath,
  isLogicalFragment,
  isPathSegment,
  isSafeRepositoryPath,
  isWindowsDeviceName,
  parseLogicalTarget,
} from "./navigation/logical.js";
export type { LogicalTarget } from "./navigation/logical.js";
export type {
  CatalogueIndexVersion,
  ChangeSnapshotVersion,
  DeploymentFileVersion,
  EntryDetailVersion,
  LiveDescriptorVersion,
} from "./generated/model.js";
export type { ArrayTag } from "./generated/catalogue/ArrayTag.js";
export type { BooleanTag } from "./generated/catalogue/BooleanTag.js";
export type { CatalogueChangeSnapshotV4 } from "./generated/catalogue/CatalogueChangeSnapshotV4.js";
export type { CatalogueChanges } from "./generated/catalogue/CatalogueChanges.js";
export type { CatalogueComponent } from "./generated/catalogue/CatalogueComponent.js";
export type { CatalogueComponentKind } from "./generated/catalogue/CatalogueComponentKind.js";
export type { CatalogueDetails } from "./generated/catalogue/CatalogueDetails.js";
export type { CatalogueDocument } from "./generated/catalogue/CatalogueDocument.js";
export type { CatalogueDocumentKind } from "./generated/catalogue/CatalogueDocumentKind.js";
export type { CatalogueIdentity } from "./generated/catalogue/CatalogueIdentity.js";
export type { CatalogueModel } from "./generated/catalogue/CatalogueModel.js";
export type { CatalogueNode } from "./generated/catalogue/CatalogueNode.js";
export type { CataloguePage } from "./generated/catalogue/CataloguePage.js";
export type { CataloguePageKind } from "./generated/catalogue/CataloguePageKind.js";
export type { CatalogueReadModel } from "./generated/catalogue/CatalogueReadModel.js";
export type { CatalogueRecord } from "./generated/catalogue/CatalogueRecord.js";
export type { CatalogueScreen } from "./generated/catalogue/CatalogueScreen.js";
export type { CatalogueScreenKind } from "./generated/catalogue/CatalogueScreenKind.js";
export type { CatalogueUsage } from "./generated/catalogue/CatalogueUsage.js";
export type { CatalogueUseCase } from "./generated/catalogue/CatalogueUseCase.js";
export type { CatalogueUseCaseKind } from "./generated/catalogue/CatalogueUseCaseKind.js";
export type { CatalogueView } from "./generated/catalogue/CatalogueView.js";
export type { ChangeKind } from "./generated/catalogue/ChangeKind.js";
export type { ChangesStatus } from "./generated/catalogue/ChangesStatus.js";
export type { ColorScheme } from "./generated/catalogue/ColorScheme.js";
export type { ComparisonSelection } from "./generated/catalogue/ComparisonSelection.js";
export type { ComponentControl } from "./generated/catalogue/ComponentControl.js";
export type { ComponentInputOwner } from "./generated/catalogue/ComponentInputOwner.js";
export type { ComponentInstanceRecord } from "./generated/catalogue/ComponentInstanceRecord.js";
export type { ComponentRangeRecord } from "./generated/catalogue/ComponentRangeRecord.js";
export type { ComponentRangeTarget } from "./generated/catalogue/ComponentRangeTarget.js";
export type { ComponentSlotRecord } from "./generated/catalogue/ComponentSlotRecord.js";
export type { ComponentSourceLocation } from "./generated/catalogue/ComponentSourceLocation.js";
export type { ComponentWireValue } from "./generated/catalogue/ComponentWireValue.js";
export type { Constant } from "./generated/catalogue/Constant.js";
export type { ControlOption } from "./generated/catalogue/ControlOption.js";
export type { DataValue } from "./generated/catalogue/DataValue.js";
export type { DeploymentFileV1 } from "./generated/catalogue/DeploymentFileV1.js";
export type { DetailEntry } from "./generated/catalogue/DetailEntry.js";
export type { DetailView } from "./generated/catalogue/DetailView.js";
export type { DocumentKey } from "./generated/catalogue/DocumentKey.js";
export type { EntryChangeReason } from "./generated/catalogue/EntryChangeReason.js";
export type { EntryContent } from "./generated/catalogue/EntryContent.js";
export type { EntryDetailV4 } from "./generated/catalogue/EntryDetailV4.js";
export type { EntryKind } from "./generated/catalogue/EntryKind.js";
export type { EntryMetadata } from "./generated/catalogue/EntryMetadata.js";
export type { EntryRecord } from "./generated/catalogue/EntryRecord.js";
export type { EvidenceOwner } from "./generated/catalogue/EvidenceOwner.js";
export type { FolderRecord } from "./generated/catalogue/FolderRecord.js";
export type { InputChange } from "./generated/catalogue/InputChange.js";
export type { JsonType } from "./generated/catalogue/JsonType.js";
export type { LiveDescriptorV3 } from "./generated/catalogue/LiveDescriptorV3.js";
export type { LiveGeneration } from "./generated/catalogue/LiveGeneration.js";
export type { ModelEntry } from "./generated/catalogue/ModelEntry.js";
export type { MovedEntrySnapshot } from "./generated/catalogue/MovedEntrySnapshot.js";
export type { NullTag } from "./generated/catalogue/NullTag.js";
export type { NumberTag } from "./generated/catalogue/NumberTag.js";
export type { ObjectTag } from "./generated/catalogue/ObjectTag.js";
export type { Primitive } from "./generated/catalogue/Primitive.js";
export type { PropSchema } from "./generated/catalogue/PropSchema.js";
export type { RelatedComponent } from "./generated/catalogue/RelatedComponent.js";
export type { RemovedEntry } from "./generated/catalogue/RemovedEntry.js";
export type { RemovedEntrySnapshot } from "./generated/catalogue/RemovedEntrySnapshot.js";
export type { RemovedPagePreview } from "./generated/catalogue/RemovedPagePreview.js";
export type { RemovedPreview } from "./generated/catalogue/RemovedPreview.js";
export type { RenderCapability } from "./generated/catalogue/RenderCapability.js";
export type { ResourceEvidence } from "./generated/catalogue/ResourceEvidence.js";
export type { ReviewEntryAddress } from "./generated/catalogue/ReviewEntryAddress.js";
export type { ReviewState } from "./generated/catalogue/ReviewState.js";
export type { RuleEvidence } from "./generated/catalogue/RuleEvidence.js";
export type { RuleStatus } from "./generated/catalogue/RuleStatus.js";
export type { SourceLocation } from "./generated/catalogue/SourceLocation.js";
export type { StringTag } from "./generated/catalogue/StringTag.js";
export type { True } from "./generated/catalogue/True.js";
export type { Types } from "./generated/catalogue/Types.js";
export type { UsageLink } from "./generated/catalogue/UsageLink.js";
export type { UseCaseStep } from "./generated/catalogue/UseCaseStep.js";
export type { ViewEvidence } from "./generated/catalogue/ViewEvidence.js";
export type { Viewport } from "./generated/catalogue/Viewport.js";
export type { VisualEntry } from "./generated/catalogue/VisualEntry.js";
export type { VisualKind } from "./generated/catalogue/VisualKind.js";
export type { Workspace } from "./generated/catalogue/Workspace.js";
