//! Render diagnostics preserve normative user text without internal crate prefixes.

use std::collections::BTreeSet;

use mokly_css::error::CssError;
use mokly_graph::error::GraphError;
use mokly_html::diagnostic_code::Code;
use mokly_html::error::HtmlError;
use mokly_model::catalogue::SourceLocation;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};

use crate::codes;

pub(crate) struct Diagnostic {
    pub(crate) code: codes::Code,
    pub(crate) message: String,
}

pub(crate) fn runtime(source: &RuntimeDiagnostic) -> Diagnostic {
    Diagnostic {
        code: if source.code == RuntimeCode::Configuration {
            codes::Code::ConfigInvalid
        } else {
            codes::Code::BuildInvalid
        },
        message: source.message.clone(),
    }
}

pub(crate) fn location(source: &SourceLocation) -> String {
    if let Some(export) = &source.export {
        format!("{} export {export}", source.path)
    } else if source.line == 0 || source.column == 0 {
        source.path.clone()
    } else {
        format!("{}:{}:{}", source.path, source.line, source.column)
    }
}

pub(crate) fn diagnostics(error: &GraphError) -> Vec<Diagnostic> {
    let mut output = Vec::new();
    collect(error, "", &mut BTreeSet::new(), &mut output);
    output
}

fn collect(
    error: &GraphError,
    entry: &str,
    seen: &mut BTreeSet<(String, String)>,
    output: &mut Vec<Diagnostic>,
) {
    match error {
        GraphError::Attempt { failures, .. } => {
            for failure in failures {
                collect(failure, entry, seen, output);
            }
        }
        GraphError::Document { entry, source } => collect(source, entry, seen, output),
        _ => {
            let (subject, detail) = match error {
                GraphError::Invalid { route, message, .. } => (
                    route
                        .rsplit_once("/index.")
                        .map_or(route.as_str(), |(entry, _)| entry),
                    message.strip_prefix(route).unwrap_or(message).to_owned(),
                ),
                _ => (entry, presentation(error)),
            };
            if seen.insert((subject.into(), detail)) {
                let source = match error {
                    GraphError::Runtime { source }
                    | GraphError::Css {
                        source: CssError::Runtime { source },
                    } => Some(source),
                    GraphError::Html { source } => source.runtime_diagnostic(),
                    _ => None,
                };
                output.push(source.map_or_else(
                    || Diagnostic {
                        code: codes::Code::BuildInvalid,
                        message: presentation(error),
                    },
                    runtime,
                ));
            }
        }
    }
}

fn presentation(error: &GraphError) -> String {
    match error {
        GraphError::Attempt { .. } | GraphError::Document { .. } => String::new(),
        GraphError::Invalid { message, .. } => message.clone(),
        GraphError::Runtime { source } => source.message.clone(),
        GraphError::Html { source } => html(source),
        GraphError::Css { source } => css(source),
        GraphError::Internal(source) => source.to_string(),
    }
}

fn html(error: &HtmlError) -> String {
    match error {
        HtmlError::Attempt { source, .. } => html(source),
        HtmlError::Runtime { source } => source.message.clone(),
        HtmlError::Route { source, .. } | HtmlError::Located { source, .. }
            if source.runtime_diagnostic().is_some() =>
        {
            html(source)
        }
        HtmlError::Located { source, .. } if source.location().is_some() => html(source),
        HtmlError::Route { source, .. } if source.location().is_some() => html(source),
        HtmlError::Route { route, source } => format!("{route}: {}", html(source)),
        HtmlError::Located {
            location: source_location,
            source,
        } => format!("{}: {}", location(source_location), html(source)),
        HtmlError::Invalid {
            code,
            message,
            location,
        } => {
            let location = location.as_ref().map_or(String::new(), |source| {
                format!("{}: ", self::location(source))
            });
            if *code == Code::BuildInvalid {
                format!("{location}{message}")
            } else {
                format!("{location}[mokly/{code}] {message}")
            }
        }
        HtmlError::Props { source } => match source {
            mokly_model::error::ModelError::Props(diagnostic)
            | mokly_model::error::ModelError::Schema(diagnostic) => format!(
                "[mokly/{}] {}{} at {:?}: {}",
                diagnostic.code,
                diagnostic.entry,
                diagnostic
                    .variant
                    .as_ref()
                    .map_or(String::new(), |variant| format!(" variant {variant}")),
                diagnostic.path,
                diagnostic.message
            ),
            mokly_model::error::ModelError::Internal(source) => source.to_string(),
        },
        HtmlError::FragmentUnavailable { handle } => {
            format!("JavaScript rendering is unavailable for {handle}")
        }
        HtmlError::Internal(source) => source.to_string(),
    }
}

fn css(error: &CssError) -> String {
    match error {
        CssError::Internal(source) => source.to_string(),
        CssError::Runtime { source } => source.message.clone(),
        CssError::Asset { message, .. } | CssError::Transform { message, .. } => message.clone(),
        CssError::Import {
            stylesheet,
            specifier,
        } => format!(
            "could not resolve CSS @import in {stylesheet}: {specifier}; use an existing stylesheet inside repoRoot"
        ),
        CssError::RootRoute { path } => format!(
            "cannot deliver imported CSS for {path}: the module path is not URL-safe; rename its file or directories (an entry path override does not change stylesheet routes)"
        ),
        CssError::PostcssUnavailable { module } => {
            format!("consumer PostCSS requires a sidecar: {module}")
        }
    }
}
