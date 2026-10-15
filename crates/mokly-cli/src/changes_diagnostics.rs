//! Preserve every historical validation diagnostic when Changes is unavailable.

use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::error::CatalogueError;
use mokly_compare::error::Error;
use mokly_git::error;
use mokly_graph::error::GraphError;
use mokly_html::error::HtmlError;

use crate::build::BuildChanges;
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
    let records = match error {
        Error::Base { source, .. } => warnings(source),
        Error::Catalogue {
            source: CatalogueError::Invalid { warnings, .. },
        } => warnings.clone(),
        Error::Graph { source } => source.warnings(),
        _ => Vec::new(),
    };
    records
        .into_iter()
        .filter(|warning| warning.code == "base-dependencies")
        .collect()
}

pub(crate) fn unavailable(error: &Error) -> Option<BuildChanges> {
    let Error::Base { commit, source } = error else {
        return None;
    };
    if let Some(detail) = limit_detail(source) {
        return Some(BuildChanges::Unavailable {
            base_commit: commit.clone(),
            reason: "comparison limit reached".into(),
            diagnostics: vec![detail],
        });
    }
    let validation = match source.as_ref() {
        Error::Catalogue { source } => !matches!(source, CatalogueError::Internal(_)),
        Error::Graph { source } => validation_graph(source),
        Error::Deferred { .. } => true,
        _ => false,
    };
    if !validation {
        return None;
    }
    Some(BuildChanges::Unavailable {
        base_commit: commit.clone(),
        reason: if matches!(source.as_ref(), Error::Deferred { .. }) {
            "base renderer unavailable"
        } else {
            "base validation failed"
        }
        .into(),
        diagnostics: details(source),
    })
}

pub(crate) fn failure_code(error: &Error) -> Code {
    match error {
        Error::Git { .. } => Code::GitFailed,
        Error::Base { source, .. } => failure_code(source),
        Error::SourceFailure { source } => failure_code(source),
        _ => Code::ReviewInvalid,
    }
}

fn validation_graph(error: &GraphError) -> bool {
    match error {
        GraphError::Internal(_) => false,
        GraphError::Attempt { failures, .. } => {
            !failures.is_empty() && failures.iter().all(validation_graph)
        }
        GraphError::Html { source } => validation_html(source),
        _ => true,
    }
}

fn validation_html(error: &HtmlError) -> bool {
    match error {
        HtmlError::Internal(_) => false,
        HtmlError::Route { source, .. }
        | HtmlError::Located { source, .. }
        | HtmlError::Attempt { source, .. } => validation_html(source),
        _ => true,
    }
}

fn limit_detail(error: &Error) -> Option<String> {
    match error {
        Error::Limit { path, source } => Some(format!("{path}: {}", plain(&source.to_string()))),
        Error::Base { source, .. } => limit_detail(source),
        Error::SourceFailure { source } => limit_detail(source),
        _ => None,
    }
}

fn plain(message: &str) -> &str {
    message
        .strip_prefix('[')
        .and_then(|message| message.split_once("] ").map(|(_, body)| body))
        .unwrap_or(message)
}

pub(crate) fn failure_detail(error: &Error) -> String {
    match error {
        Error::Git {
            source: error::Error::CommandFailed { status, stderr },
        } => {
            let status = status.map_or_else(
                || "Git ended without an exit status".into(),
                |status| format!("Git exited with status {status}"),
            );
            if stderr.is_empty() {
                status
            } else {
                format!("{status}: {}", String::from_utf8_lossy(stderr).trim())
            }
        }
        Error::Git { source } => plain(&source.to_string()).into(),
        Error::Base { commit, source } => format!("base {commit}: {}", failure_detail(source)),
        Error::SourceFailure { source } => failure_detail(source),
        _ => error.to_string(),
    }
}
