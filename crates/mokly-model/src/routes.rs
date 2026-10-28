//! Portable artifact routes and relative URL operations shared by the core.

use crate::axes::{ColorScheme, Viewport};
use crate::namespace;
use crate::review_affected::ReviewSide;

/// One screen or component document route inside the generated namespace.
pub fn view(path: &str, viewport: Viewport, scheme: ColorScheme) -> String {
    let viewport = match viewport {
        Viewport::Mobile => "mobile",
        Viewport::Desktop => "desktop",
    };
    format!("{path}/index.{viewport}{}.html", dark(scheme))
}

/// One page or Markdown document route inside the generated namespace.
pub fn document(path: &str, scheme: ColorScheme) -> String {
    format!("{path}/index{}.html", dark(scheme))
}

fn dark(scheme: ColorScheme) -> &'static str {
    match scheme {
        ColorScheme::Light => "",
        ColorScheme::Dark => ".dark",
    }
}

/// Percent-encode UTF-8 path segments, preserving only RFC 3986 unreserved bytes.
pub fn encode(path: &str) -> String {
    path.bytes()
        .map(|byte| {
            if byte.is_ascii_alphanumeric() || b"-._~/".contains(&byte) {
                char::from(byte).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}

/// Relative URL from a file route to another file route in the same namespace.
pub fn relative(source: &str, target: &str) -> String {
    let mut from: Vec<_> = source.split('/').collect();
    from.pop();
    let to: Vec<_> = target.split('/').collect();
    let common = from.iter().zip(&to).take_while(|(a, b)| a == b).count();
    "../".repeat(from.len() - common) + &encode(&to[common..].join("/"))
}

/// Resolve a relative POSIX reference within a namespace, refusing an escape.
pub fn resolve(source: &str, reference: &str) -> Option<String> {
    if reference.starts_with('/') || reference.contains(['\\', ':', '\0']) {
        return None;
    }
    let mut parts: Vec<_> = source.split('/').collect();
    parts.pop();
    if reference.is_empty() {
        return Some(source.into());
    }
    for part in reference.split('/') {
        match part {
            "." => {}
            ".." => {
                parts.pop()?;
            }
            "" => return None,
            _ => parts.push(part),
        }
    }
    Some(parts.join("/"))
}

/// Generation-relative snapshot address, retaining the graph's relative resource layout.
pub fn comparison_snapshot(side: ReviewSide, route: &str) -> String {
    let side = match side {
        ReviewSide::Before => "before",
        ReviewSide::After => "after",
    };
    format!("snapshots/{side}/{route}")
}

/// Generation-relative metadata address for a removed page or document.
pub fn comparison_preview(path: &str) -> String {
    format!("previews/{path}/index.json")
}

/// Artifact-root-relative prefix of a complete immutable comparison generation.
pub fn comparison_generation(generation: &str) -> String {
    format!("{}{generation}/", comparison_generations())
}

/// Artifact-root-relative namespace of all immutable comparison generations.
pub fn comparison_generations() -> String {
    namespace::viewer("diffs/generations/")
}

#[cfg(test)]
#[path = "_tests_/comparison_routes_tests.rs"]
mod comparison_routes_tests;
