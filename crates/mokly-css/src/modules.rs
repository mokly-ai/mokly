//! Rename-only CSS Modules use path hashes and lightningcss syntax validation.

use std::collections::BTreeMap;

use lightningcss::stylesheet::{ParserOptions, StyleSheet};
use mokly_model::material::digest;

use crate::error::{CssError, Result, TransformFailure};
use crate::{module_checks, module_integrity, rename};

/// Stable local identity shared by scoped text and the JavaScript class table.
pub fn scoped_name(path: &str, local: &str) -> String {
    let hash = digest(path.as_bytes());
    format!("mokly_{}_{local}", &hash[..12])
}

/// Scope local selectors and animations without reprinting unrelated CSS.
/// The bundler prints the validated scoped text in a separate step.
pub fn scope(path: &str, source: &str) -> Result<(String, BTreeMap<String, String>)> {
    module_checks::check(path, source)?;
    let scoped = rename::scope(path, source)?;
    module_integrity::check(path, source, &scoped.css)?;
    if let Err(error) = StyleSheet::parse(
        &scoped.css,
        ParserOptions {
            filename: path.into(),
            ..Default::default()
        },
    ) {
        let (line, column) = error.loc.as_ref().map_or((1, 1), |location| {
            scoped.original_location(location.line, location.column)
        });
        return Err(CssError::Transform {
            kind: TransformFailure::Syntax,
            message: format!(
                "could not transform CSS {path}:{line}:{column}: {}; fix the stylesheet and rebuild",
                error.kind
            ),
        });
    }
    Ok((scoped.css, scoped.exports))
}
