//! One data-free shell document shared by every shell route.

use crate::namespace::VIEWER_DIRECTORY;

/// The shell stylesheet styles the stub page through this document class.
const DOCUMENT_CLASS: &str = "mbk-document";

/// Build identical shell bytes for one catalogue title.
pub fn html(title: &str) -> Vec<u8> {
    let title = title
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;");
    format!(r#"<!doctype html>
<html lang="en" class="{DOCUMENT_CLASS}"><head><meta charset="utf-8"><title>{title}</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" type="image/svg+xml" href="/{VIEWER_DIRECTORY}/client/brand.svg"><link rel="stylesheet" href="/{VIEWER_DIRECTORY}/shell.css"></head><body><div data-mokly-shell></div><noscript>This catalogue needs JavaScript.</noscript><script type="module" src="/{VIEWER_DIRECTORY}/client/shell.js"></script></body></html>
"#).into_bytes()
}

#[cfg(test)]
#[path = "_tests_/shell_tests.rs"]
mod tests;
