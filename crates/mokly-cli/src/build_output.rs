//! Build warning, diagnostic, and discovery-summary presentation.

use mokly_catalogue::diagnostic::{self, Issue, Warning};
use mokly_catalogue::error::CatalogueError;
use mokly_model::axes::EntryKind;

use crate::build::{BuildError, BuildSummary};
use crate::codes::Code;
use crate::output::{Mode, Style, bounded};
use crate::redaction::Redactor;

/// Format a warning with one exact subject and no change to its diagnostic payload.
pub fn warnings(style: &Style, warnings: &[Warning], redactor: &Redactor) -> String {
    warnings
        .iter()
        .map(|warning| {
            let message = redactor.safe(&format!(
                "{}: {}",
                warning.printed_subject(),
                warning.message
            ));
            if style.mode == Mode::Plain {
                format!("[mokly/warning] {message}\n")
            } else {
                format!("{}\n", bounded(&format!("  ! {message}"), style.columns))
            }
        })
        .collect()
}

/// Discovery-only success. Plain mode adds no phase line and names no output.
pub fn summary(style: &Style, summary: &BuildSummary) -> String {
    if style.mode == Mode::Plain {
        return String::new();
    }
    let mut parts = vec![format!(
        "  {} Catalogue ready",
        if style.ascii { "+" } else { "✔" }
    )];
    for (kind, noun) in [
        (EntryKind::Screen, "screen"),
        (EntryKind::Page, "page"),
        (EntryKind::Document, "document"),
        (EntryKind::UseCase, "use case"),
        (EntryKind::Component, "component"),
    ] {
        if let Some(count) = summary.counts.get(&kind).filter(|count| **count > 0) {
            parts.push(format!(
                "{count} {noun}{}",
                if *count == 1 { "" } else { "s" }
            ));
        }
    }
    format!("{}\n", bounded(&parts.join(" · "), style.columns))
}

/// Report retained warnings first, then the command's typed failure.
pub fn failure(style: &Style, failure: &BuildError, redactor: &Redactor) -> String {
    match failure {
        BuildError::Deferred {
            modules,
            warnings: records,
        } => {
            warnings(style, records, redactor)
                + &style.error(
                    Code::BuildInvalid,
                    &format!(
                        "JavaScript rendering is unavailable for {}",
                        modules.join(", ")
                    ),
                    redactor,
                )
        }
        BuildError::Rendering {
            source,
            warnings: records,
        } => {
            let mut records = records.clone();
            records.extend(source.warnings());
            mokly_catalogue::diagnostic::normalize_warnings(&mut records);
            let mut output = warnings(style, &records, redactor);
            for diagnostic in crate::render_errors::diagnostics(source) {
                output.push_str(&style.error(Code::BuildInvalid, &diagnostic, redactor));
            }
            output
        }
        BuildError::Strict { warnings: records } => {
            let count = records.len();
            warnings(style, records, redactor)
                + &style.error(
                    Code::BuildInvalid,
                    &format!(
                        "{count} build warning{} with --strict",
                        if count == 1 { "" } else { "s" }
                    ),
                    redactor,
                )
        }
        BuildError::Catalogue {
            source:
                CatalogueError::Invalid {
                    issues,
                    warnings: records,
                },
        } => {
            let mut text = warnings(style, records, redactor);
            for issue in issues {
                let detail = issue_text(issue, Code::BuildInvalid);
                let diagnostic = if matches!(
                    issue.code,
                    diagnostic::Code::DuplicatePath
                        | diagnostic::Code::CaseCollision
                        | diagnostic::Code::DuplicateFolder
                        | diagnostic::Code::DuplicateMovedFrom
                ) {
                    style.error_lines(Code::BuildInvalid, &detail, redactor)
                } else {
                    style.error(Code::BuildInvalid, &detail, redactor)
                };
                text.push_str(&diagnostic);
            }
            text
        }
        BuildError::Catalogue {
            source: CatalogueError::Config(issue),
        } => style.error(
            Code::ConfigInvalid,
            &issue_text(issue, Code::ConfigInvalid),
            redactor,
        ),
        BuildError::Catalogue {
            source: CatalogueError::ConfigMissing { searched },
        } => style.error(
            Code::ConfigMissing,
            &format!(
                "no mokly.config.json found; searched: {}",
                searched.join(", ")
            ),
            redactor,
        ),
        BuildError::Catalogue { source } => {
            style.error(Code::BuildInvalid, &source.to_string(), redactor)
        }
    }
}

fn issue_text(issue: &Issue, outer: Code) -> String {
    let prefix = issue.location.as_ref().map_or(String::new(), |location| {
        format!("{}:{}:{} ", location.path, location.line, location.column)
    });
    if issue.code.as_str() == outer.presentation().0 {
        format!("{prefix}{}", issue.message)
    } else {
        format!("{prefix}[mokly/{}] {}", issue.code.as_str(), issue.message)
    }
}

#[cfg(test)]
#[path = "_tests_/build_output_tests.rs"]
mod build_output_tests;
