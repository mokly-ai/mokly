//! Stable source-attributed catalogue diagnostics.

use mokly_model::catalogue::SourceLocation;
use serde_json::Value;

/// Stable catalogue diagnostic code. Automation can branch on this enum.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Code {
    /// JavaScript authoring diagnostic `component-schema`.
    ComponentSchema,
    /// JavaScript authoring diagnostic `component-props`.
    ComponentProps,
    /// JavaScript authoring diagnostic `component-element`.
    ComponentElement,
    /// JavaScript authoring diagnostic `component-controls`.
    ComponentControls,
    /// JavaScript authoring diagnostic `component-slots`.
    ComponentSlots,
    /// JavaScript authoring diagnostic `duplicate-export`.
    DuplicateExport,
    /// JavaScript authoring diagnostic `array-export`.
    ArrayExport,
    /// JavaScript authoring diagnostic `empty-module`.
    EmptyModule,
    /// JavaScript authoring diagnostic `unknown-link-definition`.
    UnknownLinkDefinition,
    /// JavaScript authoring diagnostic `invalid-definition`.
    InvalidDefinition,

    /// Invalid configuration.
    ConfigInvalid,
    /// Invalid path segment.
    InvalidSegment,
    /// Invalid complete path.
    InvalidPath,
    /// Two entries or a leaf and folder have one identity.
    DuplicatePath,
    /// Identities differ only in ASCII case.
    CaseCollision,
    /// An index collapses to an empty path.
    RootIndex,
    /// One directory has two index documents.
    DuplicateIndex,
    /// Two records describe one folder.
    DuplicateFolder,
    /// A record has no corresponding folder.
    UnusedFolder,
    /// Order names no child.
    UnknownFolderChild,
    /// Invalid folder record.
    InvalidFolder,
    /// Invalid HTML metadata.
    HtmlFrontMatter,
    /// Forbidden, unresolved, or cyclic element.
    HtmlElement,
    /// Invalid component prop input.
    HtmlAttribute,
    /// Invalid template reference.
    HtmlProps,
    /// Invalid slot declaration or use.
    HtmlSlot,
    /// Nested variants.
    InvalidVariants,
    /// Unknown authoring field.
    InvalidField,
    /// A previous path equals the current path.
    InvalidMovedFrom,
    /// A previous path names a current entry.
    MovedFromCurrent,
    /// Two entries claim one prior path.
    DuplicateMovedFrom,
    /// Invalid document metadata.
    DocumentFrontMatter,
    /// Invalid shared entry metadata or relationship.
    InvalidMetadata,
    /// Missing logical link target.
    UnknownLinkTarget,
    /// Missing target with a known prior path.
    MovedLinkTarget,
}

impl Code {
    /// Exact kebab-case protocol identifier.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ComponentSchema => "component-schema",
            Self::ComponentProps => "component-props",
            Self::ComponentElement => "component-element",
            Self::ComponentControls => "component-controls",
            Self::ComponentSlots => "component-slots",
            Self::DuplicateExport => "duplicate-export",
            Self::ArrayExport => "array-export",
            Self::EmptyModule => "empty-module",
            Self::UnknownLinkDefinition => "unknown-link-definition",
            Self::InvalidDefinition => "invalid-definition",

            Self::ConfigInvalid => "config-invalid",
            Self::InvalidSegment => "invalid-segment",
            Self::InvalidPath => "invalid-path",
            Self::DuplicatePath => "duplicate-path",
            Self::CaseCollision => "case-collision",
            Self::RootIndex => "root-index",
            Self::DuplicateIndex => "duplicate-index",
            Self::DuplicateFolder => "duplicate-folder",
            Self::UnusedFolder => "unused-folder",
            Self::UnknownFolderChild => "unknown-folder-child",
            Self::InvalidFolder => "invalid-folder",
            Self::HtmlFrontMatter => "html-front-matter",
            Self::HtmlElement => "html-element",
            Self::HtmlAttribute => "html-attribute",
            Self::HtmlProps => "html-props",
            Self::HtmlSlot => "html-slot",
            Self::InvalidVariants => "invalid-variants",
            Self::InvalidField => "invalid-field",
            Self::InvalidMovedFrom => "invalid-moved-from",
            Self::MovedFromCurrent => "moved-from-current",
            Self::DuplicateMovedFrom => "duplicate-moved-from",
            Self::DocumentFrontMatter => "document-front-matter",
            Self::InvalidMetadata => "invalid-metadata",
            Self::UnknownLinkTarget => "unknown-link-target",
            Self::MovedLinkTarget => "moved-link-target",
        }
    }
}

/// One exact diagnostic, with a separate source coordinate for tooling.
#[derive(Clone, Debug)]
pub struct Issue {
    /// Stable diagnostic code.
    pub code: Code,
    /// Exact contract text. Identity messages include their source attribution.
    pub message: String,
    /// One-based source coordinate, when available.
    pub location: Option<SourceLocation>,
}

impl Issue {
    /// Build a diagnostic without a source coordinate.
    pub fn new(code: Code, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            location: None,
        }
    }

    /// Attach a source coordinate without changing the normative message.
    pub fn at(mut self, source: SourceLocation) -> Self {
        self.location = Some(source);
        self
    }
}

/// Private non-fatal warning subject. Exactly one route or subject is encoded.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WarningSubject {
    /// A rendered document route.
    Route(String),
    /// A resolved screen, page, document, or use-case entry.
    Entry(String),
    /// A resolved component entry.
    Component(String),
    /// A folder, empty for the top level.
    Folder(String),
    /// Configuration file relative to the repository.
    Configuration(String),
}

/// One normalized, non-fatal build warning.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Warning {
    /// Stable warning code.
    pub code: &'static str,
    /// Exactly one route or subject.
    pub subject: WarningSubject,
    /// Single-line detail without subject prefix.
    pub message: String,
}

impl Warning {
    /// Protocol subject presentation.
    pub fn printed_subject(&self) -> String {
        match &self.subject {
            WarningSubject::Route(path) => path.clone(),
            WarningSubject::Entry(path) => format!("entry {}", Value::String(path.clone())),
            WarningSubject::Component(path) => format!("component {}", Value::String(path.clone())),
            WarningSubject::Folder(path) => format!("folder {}", Value::String(path.clone())),
            WarningSubject::Configuration(path) => {
                format!("configuration {}", Value::String(path.clone()))
            }
        }
    }
}

/// Sort and deduplicate warnings by the terminal contract, independently of execution order.
pub fn normalize_warnings(warnings: &mut Vec<Warning>) {
    warnings.sort_by_cached_key(|warning| {
        (
            warning.printed_subject(),
            warning.message.clone(),
            warning.code,
        )
    });
    warnings.dedup();
}

#[cfg(test)]
#[path = "_tests_/diagnostic_tests.rs"]
mod diagnostic_tests;
