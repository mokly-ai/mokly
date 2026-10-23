//! Build warning, diagnostic, and discovery-summary presentation.

use std::path::Path;

use mokly_catalogue::diagnostic::{self, Issue, Warning};
use mokly_catalogue::error::CatalogueError;
use mokly_graph::error::GraphError;
use mokly_model::axes::EntryKind;

use crate::build::{BuildError, BuildSummary, strict_count};
use crate::codes::Code;
use crate::output::{Mode, Style, bounded};
use crate::pre_installation;
use crate::publication::failure::{BuildFailure, Category};
use crate::recovery_output;
use crate::redaction::Redactor;
use crate::static_errors;

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
pub fn summary(style: &Style, summary: &BuildSummary, redactor: &Redactor) -> String {
    catalogue_summary(style, summary)
        + &crate::changes_output::summary(style, &summary.changes, redactor)
}

/// Catalogue counts shared by build and Serve without comparison status.
pub fn catalogue_summary(style: &Style, summary: &BuildSummary) -> String {
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
pub fn failure(style: &Style, failure: &BuildError, redactor: &Redactor, cwd: &Path) -> String {
    failure_detail(style, failure, redactor) + &recovery_output::build(failure, cwd, redactor)
}

fn failure_detail(style: &Style, failure: &BuildError, redactor: &Redactor) -> String {
    if pre_installation::cancelled(failure) && !matches!(failure, BuildError::Shutdown { .. }) {
        return style.error(Code::BuildInvalid, "build cancelled", redactor);
    }
    warnings(style, &warning_records(failure), redactor)
        + &failure_diagnostics(style, failure, redactor)
}

/// Retained warnings from one failed preparation attempt.
pub fn warning_records(failure: &BuildError) -> Vec<Warning> {
    let mut records = match failure {
        BuildError::Deferred { warnings, .. }
        | BuildError::Strict { warnings }
        | BuildError::Comparison { warnings, .. } => warnings.clone(),
        BuildError::Catalogue {
            source: CatalogueError::Invalid { warnings, .. },
        } => warnings.clone(),
        BuildError::Rendering { source, warnings } => {
            let mut records = warnings.clone();
            records.extend(source.warnings());
            records
        }
        _ => Vec::new(),
    };
    mokly_catalogue::diagnostic::normalize_warnings(&mut records);
    records
}

/// Format only typed failure details, so watched actions can own warning order.
pub fn failure_diagnostics(style: &Style, failure: &BuildError, redactor: &Redactor) -> String {
    match failure {
        BuildError::Comparison {
            base_ref,
            source,
            ..
        } => {
            if matches!(source.as_ref(), mokly_compare::error::Error::Git { .. }) {
                return style.error(Code::GitFailed, &format!("Git information could not be read for {base_ref}. Check the repository and configured base."), redactor);
            }
            style.error(
                    crate::changes_diagnostics::failure_code(source),
                    &format!(
                        "comparison against base ref {base_ref:?} failed: {}",
                        crate::changes_diagnostics::failure_detail(source)
                    ),
                    redactor,
                )
        }
        BuildError::RestartRequired { setting } => style.error(
            Code::BuildInvalid,
            &format!("{setting} changed. Restart Serve to apply this setting."),
            redactor,
        ),
        BuildError::Interrupted { .. } => style.error(Code::BuildInvalid, "build cancelled", redactor),
        BuildError::Shutdown { primary, shutdown } => {
            let code = if pre_installation::cancelled(primary) { Code::BuildInvalid } else { match primary.category() {
                Category::BuildInvalid => Code::BuildInvalid,
                Category::ConfigInvalid => Code::ConfigInvalid,
                Category::ConfigMissing => Code::ConfigMissing,
                Category::ExportInvalid => Code::ExportInvalid,
                Category::GitFailed => Code::GitFailed,
                Category::ReviewInvalid => Code::ReviewInvalid,
                Category::ServerFailed => Code::ViewerUnavailable,
            } };
            let primary = if pre_installation::cancelled(primary) { "build cancelled".into() } else { recovery_output::cause(primary) };
            style.error_lines(code, &format!("{primary}\nRender shutdown failed: {}", recovery_output::cause(shutdown)), redactor)
        },
        BuildError::Cleanup { primary, cleanup, .. } => {
            let message = format!("{}\nRecovery failed: {}", recovery_output::cause(primary), static_errors::detail(cleanup));
            style.error_lines(Code::ExportInvalid, &message, redactor)
        },
        BuildError::Viewer => style.error(Code::ViewerUnavailable, "Build or reinstall the matching @mokly/viewer package and retry.", redactor),
        BuildError::Static { source: mokly_static::error::Error::Cancelled } => style.error(Code::BuildInvalid, "build cancelled", redactor),
        BuildError::Static { source } => style.error_lines(static_errors::code(source), &static_errors::detail(source), redactor),
        BuildError::Git { base, .. } => style.error(Code::GitFailed, &format!("Git information could not be read for {base}. Check the repository and configured base."), redactor),
        BuildError::Cancelled => style.error(Code::BuildInvalid, "build cancelled", redactor),
        BuildError::Deferred {
            modules,
            warnings: _,
        } => style.error(
            Code::BuildInvalid,
            &format!(
                "JavaScript rendering is unavailable for {}",
                modules.join(", ")
            ),
            redactor,
        ),
        BuildError::Rendering { source, .. } => render_diagnostics(style, source, redactor),
        BuildError::Strict { warnings: records } => {
            let count = strict_count(records);
            style.error(
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
                    warnings: _,
                },
        } => {
            let mut text = String::new();
            for issue in issues {
                let detail = issue_text(issue, Code::BuildInvalid);
                let diagnostic = if matches!(
                    issue.code,
                    diagnostic::Code::DuplicateExport
                        | diagnostic::Code::DuplicatePath
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
            source: CatalogueError::Runtime { source },
        } => {
            let diagnostic = crate::render_errors::runtime(source);
            style.error(diagnostic.code, &diagnostic.message, redactor)
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

/// Report borrowed graph failures without repeating per-request build warnings.
pub fn render_diagnostics(style: &Style, error: &GraphError, redactor: &Redactor) -> String {
    crate::render_errors::diagnostics(error)
        .iter()
        .map(|diagnostic| style.error(diagnostic.code, &diagnostic.message, redactor))
        .collect()
}

pub(crate) fn issue_text(issue: &Issue, outer: Code) -> String {
    if issue.message_has_location {
        return format!("[mokly/{}] {}", issue.code.as_str(), issue.message);
    }
    let mut prefix = issue
        .location
        .as_ref()
        .map_or(String::new(), crate::render_errors::location);
    if let Some(path) = &issue.entry_path {
        prefix.push_str(&format!(" ({path})"));
    }
    if !prefix.is_empty() {
        prefix.push_str(": ");
    }
    if issue.code.as_str() == outer.presentation().0 {
        format!("{prefix}{}", issue.message)
    } else {
        format!("{prefix}[mokly/{}] {}", issue.code.as_str(), issue.message)
    }
}

#[cfg(test)]
#[path = "_tests_/build_output_tests.rs"]
mod build_output_tests;

#[cfg(test)]
#[path = "_tests_/static_failure_tests.rs"]
mod static_failure_tests;
