/** Public read model v9, entry detail v4, deployment file v1 and live descriptor v3 shapes. */

import type {
  CatalogueComponent,
  CatalogueScreen,
  RemovedPreview,
} from "@mokly/model";

export type {
  CatalogueChanges,
  CatalogueComponent,
  CatalogueDetails,
  CatalogueDocument,
  CatalogueIdentity,
  CatalogueNode,
  CataloguePage,
  CatalogueReadModel,
  CatalogueRecord,
  CatalogueScreen,
  CatalogueUsage,
  CatalogueUseCase,
  CatalogueView,
  ChangeKind,
  ChangesStatus,
  ComparisonSelection,
  DetailEntry,
  DetailView,
  DeploymentFileV1,
  DocumentKey,
  EntryDetailV4,
  EntryKind,
  EvidenceOwner,
  InputChange,
  LiveDescriptorV3,
  LiveGeneration,
  RelatedComponent,
  RemovedEntry,
  RenderCapability,
  ResourceEvidence,
  ReviewEntryAddress,
  ReviewState,
  RuleEvidence,
  RuleStatus,
  UsageLink,
  UseCaseStep,
  ViewEvidence,
  Workspace,
} from "@mokly/model";

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
  | "path"
  | "detailId"
  | "previousPath"
  | "title"
  | "tags"
  | "details"
  | "changes"
>;
