//! Render diagnostics preserve normative user text without internal crate prefixes.

use std::collections::BTreeSet;

use mokly_css::error::CssError;
use mokly_graph::error::GraphError;
use mokly_html::diagnostic_code::Code;
use mokly_html::error::HtmlError;

pub(crate) fn diagnostics(error: &GraphError) -> Vec<String> {
    let mut output = Vec::new();
    collect(error, "", &mut BTreeSet::new(), &mut output);
    output
}

fn collect(
    error: &GraphError,
    entry: &str,
    seen: &mut BTreeSet<(String, String)>,
    output: &mut Vec<String>,
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
                output.push(presentation(error));
            }
        }
    }
}

fn presentation(error: &GraphError) -> String {
    match error {
        GraphError::Attempt { .. } | GraphError::Document { .. } => String::new(),
        GraphError::Invalid { message, .. } => message.clone(),
        GraphError::Html { source } => html(source),
        GraphError::Css { source } => css(source),
        GraphError::Internal(source) => source.to_string(),
    }
}

fn html(error: &HtmlError) -> String {
    match error {
        HtmlError::Attempt { source, .. } => html(source),
        HtmlError::Route { source, .. } if source.location().is_some() => html(source),
        HtmlError::Route { route, source } => format!("{route}: {}", html(source)),
        HtmlError::Located { location, source } => format!(
            "{}:{}:{}: {}",
            location.path,
            location.line,
            location.column,
            html(source)
        ),
        HtmlError::Invalid {
            code,
            message,
            location,
        } => {
            let location = location.as_ref().map_or(String::new(), |location| {
                format!("{}:{}:{}: ", location.path, location.line, location.column)
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
