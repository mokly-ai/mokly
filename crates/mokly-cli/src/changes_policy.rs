//! Explicit historical validation and runtime failure policy.

use mokly_catalogue::error::CatalogueError;
use mokly_compare::error::Error;
use mokly_css::error::CssError;
use mokly_graph::error::GraphError;
use mokly_html::error::HtmlError;
use mokly_model::runtime_diagnostic::RuntimeCode;

use crate::codes::Code;

const VALIDATION: &str = "base validation failed";

pub(crate) fn unavailable(error: &Error) -> Option<&'static str> {
    match error {
        Error::Catalogue { source } => match source {
            CatalogueError::Runtime { source } => runtime(source.code),
            CatalogueError::Internal(_) => None,
            CatalogueError::Config(_)
            | CatalogueError::ConfigMissing { .. }
            | CatalogueError::Invalid { .. } => Some(VALIDATION),
        },
        Error::Graph { source } => graph(source),
        _ => None,
    }
}

fn runtime(code: RuntimeCode) -> Option<&'static str> {
    match code {
        RuntimeCode::Cancelled | RuntimeCode::Protocol => None,
        RuntimeCode::Timeout => Some("base runtime timed out"),
        RuntimeCode::Unavailable => Some("base runtime unavailable"),
        RuntimeCode::Version => Some("base runtime version mismatch"),
        RuntimeCode::Configuration
        | RuntimeCode::Build
        | RuntimeCode::Bundle
        | RuntimeCode::Render => Some(VALIDATION),
    }
}

fn graph(error: &GraphError) -> Option<&'static str> {
    match error {
        GraphError::Runtime { source } => runtime(source.code),
        GraphError::Document { source, .. } => graph(source),
        GraphError::Attempt { failures, .. } => {
            if failures.is_empty() {
                return None;
            }
            let mut reason = VALIDATION;
            for failure in failures {
                let next = graph(failure)?;
                if next != VALIDATION {
                    reason = next;
                }
            }
            Some(reason)
        }
        GraphError::Internal(_) => None,
        GraphError::Html { source } => html(source),
        GraphError::Css { source } => match source {
            CssError::Runtime { source } => runtime(source.code),
            CssError::Internal(_) => None,
            CssError::RootRoute { .. }
            | CssError::Import { .. }
            | CssError::Asset { .. }
            | CssError::Transform { .. }
            | CssError::PostcssUnavailable { .. } => Some(VALIDATION),
        },
        GraphError::Invalid { .. } => Some(VALIDATION),
    }
}

pub(crate) fn failure_code(error: &GraphError) -> Code {
    match error {
        GraphError::Runtime { .. }
        | GraphError::Css {
            source: CssError::Runtime { .. },
        } => Code::BuildInvalid,
        GraphError::Html { source } if source.runtime_diagnostic().is_some() => Code::BuildInvalid,
        GraphError::Document { source, .. } => failure_code(source),
        GraphError::Attempt { failures, .. } => failures
            .iter()
            .find(|failure| graph(failure).is_none())
            .map_or(Code::ReviewInvalid, failure_code),
        _ => Code::ReviewInvalid,
    }
}

fn html(error: &HtmlError) -> Option<&'static str> {
    match error {
        HtmlError::Runtime { source } => runtime(source.code),
        HtmlError::Internal(_) => None,
        HtmlError::Route { source, .. }
        | HtmlError::Located { source, .. }
        | HtmlError::Attempt { source, .. } => html(source),
        HtmlError::Invalid { .. }
        | HtmlError::Props { .. }
        | HtmlError::FragmentUnavailable { .. } => Some(VALIDATION),
    }
}

#[cfg(test)]
#[path = "_tests_/changes_policy_tests.rs"]
mod changes_policy_tests;
