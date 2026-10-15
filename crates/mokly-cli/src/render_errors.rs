//! Render diagnostics preserve normative user text without internal crate prefixes.

use mokly_css::error::CssError;
use mokly_graph::error::GraphError;
use mokly_html::error::HtmlError;

pub(crate) fn diagnostics(error: &GraphError) -> Vec<String> {
    match error {
        GraphError::Attempt { failures, .. } => failures.iter().flat_map(diagnostics).collect(),
        GraphError::Invalid { message, .. } => vec![message.clone()],
        GraphError::Html { source } => vec![html(source)],
        GraphError::Css { source } => vec![css(source)],
        GraphError::Internal(source) => vec![source.to_string()],
    }
}

fn html(error: &HtmlError) -> String {
    match error {
        HtmlError::Attempt { source, .. } => html(source),
        HtmlError::Route { route, source } => format!("{route}: {}", html(source)),
        HtmlError::Located { location, source } => format!(
            "{}:{}:{} {}",
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
                format!("{}:{}:{} ", location.path, location.line, location.column)
            });
            if *code == "build-invalid" {
                format!("{location}{message}")
            } else {
                format!("{location}[mokly/{code}] {message}")
            }
        }
        HtmlError::Props { source } => match source {
            mokly_model::error::ModelError::Props(diagnostic)
            | mokly_model::error::ModelError::Schema(diagnostic) => diagnostic.to_string(),
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
