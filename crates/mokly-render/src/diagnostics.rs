//! Preserve sidecar authoring codes and defer inference warning subjects to Rust.

use mokly_catalogue::diagnostic::{Code, Issue};
use mokly_model::catalogue::SourceLocation;
use mokly_sidecar::diagnostics::{DefinitionCode, DefinitionDiagnostic};

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
    let mut issue = Issue::new(code, diagnostic.message.clone()).at(SourceLocation {
        path: diagnostic.module.clone(),
        line: 0,
        column: 0,
        export: diagnostic.export_name.clone(),
    });
    issue.message_has_location = matches!(
        diagnostic.code,
        DefinitionCode::ArrayExport
            | DefinitionCode::DuplicateExport
            | DefinitionCode::EmptyModule
            | DefinitionCode::InvalidDefinition
            | DefinitionCode::UnknownLinkDefinition
    );
    issue
}
