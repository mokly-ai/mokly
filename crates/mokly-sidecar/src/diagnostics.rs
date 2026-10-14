//! Source-attributed authoring diagnostics returned by describe.

use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

/// Describe-time authoring failures; each presents as build-invalid.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, Error, TS)]
#[serde(rename_all = "kebab-case")]
pub enum DefinitionCode {
    /// One definition has two exporting modules.
    #[error("duplicate-export")]
    DuplicateExport,
    /// An entry module exports no definition.
    #[error("empty-module")]
    EmptyModule,
    /// An export contains an array instead of one definition.
    #[error("array-export")]
    ArrayExport,
    /// A referenced definition has no exported entry.
    #[error("unknown-link-definition")]
    UnknownLinkDefinition,
    /// An export has no definition brand.
    #[error("invalid-definition")]
    InvalidDefinition,
    /// A move names the entry's own path.
    #[error("invalid-moved-from")]
    InvalidMovedFrom,
    /// A move names another current entry.
    #[error("moved-from-current")]
    MovedFromCurrent,
    /// A previous path has two claimants.
    #[error("duplicate-moved-from")]
    DuplicateMovedFrom,
    /// An input declares an unknown field.
    #[error("invalid-field")]
    InvalidField,
    /// A variant declares invalid variant metadata.
    #[error("invalid-variants")]
    InvalidVariants,
    /// A folder definition is invalid.
    #[error("invalid-folder")]
    InvalidFolder,
    /// A component schema fails the Rust profile validator.
    #[error("component-schema")]
    ComponentSchema,
    /// A component supplies invalid data props.
    #[error("component-props")]
    ComponentProps,
    /// A component element declaration is invalid.
    #[error("component-element")]
    ComponentElement,
    /// A component control declaration is invalid.
    #[error("component-controls")]
    ComponentControls,
    /// A component slot declaration is invalid.
    #[error("component-slots")]
    ComponentSlots,
}

/// One failure attributed to its module and optional export.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DefinitionDiagnostic {
    /// Exact authoring diagnostic category.
    pub code: DefinitionCode,
    /// Repository-relative source module.
    pub module: String,
    /// Export name when a particular export failed.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub export_name: Option<String>,
    /// Safe detail following the owning authoring contract.
    pub message: String,
}
