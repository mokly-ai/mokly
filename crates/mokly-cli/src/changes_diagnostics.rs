//! Preserve every historical validation diagnostic when Changes is unavailable.

use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::error::CatalogueError;
use mokly_compare::error::Error;

use crate::build_output::issue_text;
use crate::codes::Code;
use crate::render_errors;

pub(crate) fn details(error: &Error) -> Vec<String> {
    match error {
        Error::Catalogue {
            source: CatalogueError::Invalid { issues, .. },
        } => issues
            .iter()
            .map(|issue| issue_text(issue, Code::BuildInvalid))
            .collect(),
        Error::Catalogue {
            source: CatalogueError::Config(issue),
        } => vec![issue_text(issue, Code::ConfigInvalid)],
        Error::Graph { source } => render_errors::diagnostics(source),
        _ => vec![error.to_string()],
    }
}

pub(crate) fn warnings(error: &Error) -> Vec<Warning> {
    match error {
        Error::Catalogue {
            source: CatalogueError::Invalid { warnings, .. },
        } => warnings.clone(),
        Error::Graph { source } => source.warnings(),
        _ => Vec::new(),
    }
}
