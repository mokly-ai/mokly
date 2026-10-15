//! Preserve sidecar authoring codes and defer inference warning subjects to Rust.

use mokly_catalogue::diagnostic::{Code, Issue, Warning, WarningSubject};
use mokly_model::catalogue::SourceLocation;
use mokly_sidecar::diagnostics::{DefinitionCode, DefinitionDiagnostic};
use mokly_sidecar::results;

pub(crate) fn issue(diagnostic: &DefinitionDiagnostic) -> Issue {
    let code = match diagnostic.code {
        DefinitionCode::DuplicateExport => Code::DuplicateExport,
        DefinitionCode::EmptyModule => Code::EmptyModule,
        DefinitionCode::ArrayExport => Code::ArrayExport,
        DefinitionCode::UnknownLinkDefinition => Code::UnknownLinkDefinition,
        DefinitionCode::InvalidDefinition => Code::InvalidDefinition,
        DefinitionCode::InvalidMovedFrom => Code::InvalidMovedFrom,
        DefinitionCode::MovedFromCurrent => Code::MovedFromCurrent,
        DefinitionCode::DuplicateMovedFrom => Code::DuplicateMovedFrom,
        DefinitionCode::InvalidField => Code::InvalidField,
        DefinitionCode::InvalidVariants => Code::InvalidVariants,
        DefinitionCode::InvalidFolder => Code::InvalidFolder,
        DefinitionCode::ComponentSchema => Code::ComponentSchema,
        DefinitionCode::ComponentProps => Code::ComponentProps,
        DefinitionCode::ComponentElement => Code::ComponentElement,
        DefinitionCode::ComponentControls => Code::ComponentControls,
        DefinitionCode::ComponentSlots => Code::ComponentSlots,
    };
    Issue::new(code, diagnostic.message.clone()).at(SourceLocation {
        path: diagnostic.module.clone(),
        line: 1,
        column: 1,
        export: diagnostic.export_name.clone(),
    })
}

pub(crate) fn warnings(values: &[results::Warning], route: &str) -> Vec<Warning> {
    values
        .iter()
        .map(|warning| Warning {
            code: match warning.code {
                results::WarningCode::BaseDependencies => "base-dependencies",
                results::WarningCode::DuplicateComponentStylesheet => {
                    "duplicate-component-stylesheet"
                }
                results::WarningCode::HtmlFosterParented => "html-foster-parented",
                results::WarningCode::HtmlUnusedProps => "html-unused-props",
                results::WarningCode::LinkControlAncestor => "link-control-ancestor",
                results::WarningCode::LinkControlDescendant => "link-control-descendant",
                results::WarningCode::MarkerInRawText => "marker-in-raw-text",
                results::WarningCode::PropsNotData => "props-not-data",
            },
            subject: WarningSubject::Route(route.into()),
            message: warning.message.clone(),
        })
        .collect()
}
