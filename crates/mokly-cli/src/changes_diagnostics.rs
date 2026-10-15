//! Preserve every historical validation diagnostic when Changes is unavailable.

use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::error::CatalogueError;
use mokly_compare::error::Error;
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

pub(crate) fn failure_detail(error: &Error) -> String {
    match error {
        Error::Git {
            source: mokly_git::error::Error::CommandFailed { stderr, .. },
        } if !stderr.is_empty() => {
            format!("{error}: {}", String::from_utf8_lossy(stderr).trim())
        }
        Error::Base { commit, source } => format!("base {commit}: {}", failure_detail(source)),
        Error::SourceFailure { source } => failure_detail(source),
        _ => error.to_string(),
    }
}
