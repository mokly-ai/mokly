//! Content type lookup for stylesheet asset paths.

use mokly_model::content_types;

/// Content type of a CSS `url()` target, with the existing bare-name fallback.
pub(crate) fn stylesheet_content_type(path: &str) -> Option<&'static str> {
    content_types::stylesheet_content_type(path.rsplit('.').next()?)
}

#[cfg(test)]
#[path = "_tests_/imported_assets_tests.rs"]
mod imported_assets_tests;
