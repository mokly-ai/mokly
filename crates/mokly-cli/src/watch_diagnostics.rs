//! Watched catalogue issues keep one source coordinate and one diagnostic code.

use mokly_catalogue::diagnostic::Issue;
use mokly_catalogue::error::CatalogueError;

use crate::build::BuildError;
use crate::build_output;
use crate::output::Style;
use crate::redaction::Redactor;
use crate::render_errors;

/// Render source issues in the watched failure layout without an outer build code.
pub fn diagnostics(style: &Style, failure: &BuildError, redactor: &Redactor) -> String {
    match failure {
        BuildError::Catalogue {
            source: CatalogueError::Invalid { issues, .. },
        } => issues
            .iter()
            .map(|issue| format!("{}\n", redactor.safe(&issue_line(issue))))
            .collect(),
        _ => build_output::failure_diagnostics(style, failure, redactor),
    }
}
fn issue_line(issue: &Issue) -> String {
    let prefix = if issue.message_has_location {
        String::new()
    } else {
        let mut location = issue
            .location
            .as_ref()
            .map_or(String::new(), render_errors::location);
        if let Some(entry) = &issue.entry_path {
            if !location.is_empty() {
                location.push(' ');
            }
            location.push_str(&format!("({entry})"));
        }
        if !location.is_empty() {
            location.push(' ');
        }
        location
    };
    format!("{prefix}[mokly/{}] {}", issue.code.as_str(), issue.message)
}

#[cfg(test)]
#[path = "_tests_/watch_diagnostics_tests.rs"]
mod watch_diagnostics_tests;
