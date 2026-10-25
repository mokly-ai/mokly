//! Typed public payload contract failures shared by index, detail, and live readers.

use thiserror::Error;

/// A specific semantic rule violated by a decoded public payload.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Error)]
pub enum ContractViolation {
    /// Invalid review identities, sides, reasons, evidence, or canonical order.
    #[error("invalid review identities, sides, reasons, evidence, or canonical order")]
    Review,
    /// Invalid catalogue or deployment identity.
    #[error("invalid catalogue or deployment identity")]
    Identity,
    /// Invalid live generation.
    #[error("invalid live generation")]
    LiveGeneration,
    /// Duplicate or case-colliding current entry path.
    #[error("duplicate or case-colliding current entry path")]
    DuplicateCurrentPath,
    /// Invalid screen variant relationship.
    #[error("invalid screen variant relationship")]
    ScreenVariant,
    /// Nonreciprocal use-case membership.
    #[error("nonreciprocal use-case membership")]
    FlowMembership,
    /// Invalid component variant relationship.
    #[error("invalid component variant relationship")]
    ComponentVariant,
    /// Component parent supplies variant slots.
    #[error("component parent supplies variant slots")]
    ParentSlots,
    /// Invalid or nonreciprocal use-case step.
    #[error("invalid or nonreciprocal use-case step")]
    FlowStep,
    /// Invalid page document key.
    #[error("invalid page document key")]
    PageDocumentKey,
    /// Invalid document scheme keys.
    #[error("invalid document scheme keys")]
    DocumentKeys,
    /// Invalid entry path or title.
    #[error("invalid entry path or title")]
    EntryMetadata,
    /// Invalid source metadata path.
    #[error("invalid source metadata path")]
    SourcePath,
    /// Invalid or duplicate tag.
    #[error("invalid or duplicate tag")]
    Tags,
    /// Invalid view order or document key.
    #[error("invalid view order or document key")]
    Views,
    /// Component own comparison eligibility differs from its ready kind.
    #[error("invalid component comparison eligibility")]
    ComponentComparisonEligibility,
    /// View comparison eligibility differs from its ready kind and entry type.
    #[error("invalid comparison eligibility")]
    ComparisonEligibility,
    /// Invalid schema encoding.
    #[error("invalid schema encoding")]
    SchemaEncoding,
    /// Invalid public prop schema.
    #[error("invalid public prop schema")]
    Schema,
    /// Invalid tagged props.
    #[error("invalid tagged props")]
    WireProps,
    /// Invalid prop encoding.
    #[error("invalid prop encoding")]
    PropsEncoding,
    /// Recorded props fail the schema.
    #[error("recorded props fail the schema")]
    PropsSchema,
    /// Invalid color scheme order.
    #[error("invalid color scheme order")]
    ColorSchemes,
    /// Tree must contain each current entry exactly once.
    #[error("tree must contain each current entry exactly once")]
    TreeEntries,
    /// Invalid folder node.
    #[error("invalid folder node")]
    TreeFolder,
    /// Folder index must be its first entry child.
    #[error("folder index must be its first entry child")]
    TreeIndex,
    /// Invalid or duplicate entry tree node.
    #[error("invalid or duplicate entry tree node")]
    TreeEntry,
    /// Variant is outside its parent or has children.
    #[error("variant is outside its parent or has children")]
    TreeVariant,
    /// Empty entry children.
    #[error("empty entry children")]
    EmptyChildren,
    /// Invalid tree order.
    #[error("invalid tree order")]
    TreeOrder,
    /// Current and removed fences are exclusive.
    #[error("current and removed fences are exclusive")]
    DetailFence,
    /// Invalid render capability.
    #[error("invalid render capability")]
    RenderCapability,
    /// Unknown or misplaced payload field.
    #[error("unknown or misplaced payload field")]
    UnknownField,
    /// Current entry cannot have removed aggregate changes.
    #[error("current entry cannot have removed aggregate changes")]
    CurrentRemoved,
    /// Invalid comparison generation URL.
    #[error("invalid comparison generation URL")]
    ComparisonUrl,
    /// Removed entry must have removed changes.
    #[error("removed entry must have removed changes")]
    RemovedChanges,
    /// Removed entry cannot carry previousPath.
    #[error("removed entry cannot carry previousPath")]
    RemovedPreviousPath,
    /// Duplicate or case-colliding removed entry path.
    #[error("duplicate or case-colliding removed entry path")]
    DuplicateRemovedPath,
    /// ParentTitle is required exactly on removed variants.
    #[error("parentTitle is required exactly on removed variants")]
    RemovedParentTitle,
    /// Invalid historical variant path.
    #[error("invalid historical variant path")]
    RemovedVariant,
    /// Invalid or duplicate snapshot identity.
    #[error("invalid or duplicate snapshot identity")]
    Snapshot,
    /// Snapshot identity is required with comparisonUrl.
    #[error("snapshot identity is required with comparisonUrl")]
    MissingSnapshot,
    /// Invalid detail identity or fence value.
    #[error("invalid detail identity or fence value")]
    DetailIdentity,
    /// Invalid detail entry path.
    #[error("invalid detail entry path")]
    DetailPath,
    /// Views and workspace belong only to visual entries.
    #[error("views and workspace belong only to visual entries")]
    DetailKind,
    /// Detail control order must list every editable property exactly once.
    #[error("detail control order must list every editable property exactly once")]
    ControlOrder,
    /// Root resource evidence belongs only to pages.
    #[error("root resource evidence belongs only to pages")]
    DetailEvidence,
    /// Detail review reasons must use the review's sorted unique order.
    #[error("detail review reasons must use the review's sorted unique order")]
    DetailReasons,
    /// Detail reasons are present exactly for ready included index records.
    #[error("detail reasons must match ready included Changes membership")]
    DetailReasonsPresence,
    /// Instance or slot key does not match its material preimage.
    #[error("invalid usage digest or local id")]
    UsageKey,
    /// Usage arrays or input-scope encounter order are invalid.
    #[error("invalid usage order or duplicate record")]
    UsageOrder,
    /// A usage record names an absent or incompatible record.
    #[error("invalid usage reference")]
    UsageReference,
    /// A usage input graph contains a cycle.
    #[error("usage ownership or slot graph contains a cycle")]
    UsageCycle,
    /// A source location is unsafe or has invalid coordinates.
    #[error("invalid usage source location")]
    UsageSource,
    /// Physical region order, parent, root, or coverage is invalid.
    #[error("invalid usage range")]
    UsageRange,
    /// Invalid recorded usage props.
    #[error("invalid recorded usage props")]
    UsageProps,
}
