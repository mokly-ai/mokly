//! Composition outside the design library uses the registered components.

use std::sync::LazyLock;

use mokly_test_support::files::tree;
use mokly_test_support::workspace;
use regex::Regex;

/// The class tokens that draw each library component's root, and the device frame's caption.
const LIBRARY_ROOTS: [&[&str]; 18] = [
    &["mbk-topbar"],
    &["mbk-nav-head"],
    &["mbk-screen-head"],
    &["mbk-appearance"],
    &["mbk-cmp-toolbar"],
    &["ce-view-controls"],
    &["mbk-tag-picker"],
    &["mbk-chip", "tag"],
    &["ce-change-status"],
    &["ce-inspector"],
    &["mbk-meta-row"],
    &["ce-control-row"],
    &["phone-frame"],
    &["browser-frame"],
    &["mbk-frame-label"],
    &["mbk-compare-side"],
    &["mbk-empty"],
    &["flow-step"],
];

static CLASS_NAME: LazyLock<Regex> = LazyLock::new(|| Regex::new(r#"className=(["'{])"#).unwrap());
static LITERAL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#""([^"]*)"|'([^']*)'|`([^`]*)`"#).unwrap());
static SUBSTITUTION: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\$\{[^}]*\}").unwrap());
static LIBRARY_IMPORT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"from ["'][^"']*\.view\.js["']"#).unwrap());

fn brace_end(source: &[u8], start: usize) -> usize {
    let mut depth = 0;
    for (at, byte) in source.iter().enumerate().skip(start) {
        if *byte == b'{' {
            depth += 1;
        } else if *byte == b'}' {
            depth -= 1;
            if depth == 0 {
                return at;
            }
        }
    }
    source.len() - 1
}

/// The class tokens of each `className` attribute, with substitutions removed.
fn class_name_tokens(source: &str) -> Vec<Vec<String>> {
    CLASS_NAME
        .captures_iter(source)
        .map(|capture| {
            let opener = &capture[1];
            let start = capture.get(0).unwrap().start() + "className=".len();
            let end = if opener == "{" {
                Some(brace_end(source.as_bytes(), start))
            } else {
                source[start + 1..]
                    .find(opener)
                    .map(|offset| start + 1 + offset)
            };
            // An unclosed quote has no value.
            let value = end.map_or("", |end| &source[start..=end]);
            LITERAL
                .captures_iter(value)
                .map(|literal| {
                    let text = literal
                        .get(1)
                        .or(literal.get(2))
                        .or(literal.get(3))
                        .map_or("", |found| found.as_str());
                    SUBSTITUTION.replace_all(text, " ").into_owned()
                })
                .collect::<Vec<_>>()
                .join(" ")
                .split_whitespace()
                .map(str::to_owned)
                .collect()
        })
        .collect()
}

/// No design module outside the library imports a library implementation or redraws a root.
pub(super) fn bypass_violations() -> Vec<String> {
    let mut violations = Vec::new();
    for (file, bytes) in tree(&workspace::root().join("examples/basic/specs/design")) {
        if !(file.ends_with(".ts") || file.ends_with(".tsx")) || file.starts_with("library/") {
            continue;
        }
        let source = String::from_utf8(bytes).unwrap();
        let tokens = class_name_tokens(&source);
        if LIBRARY_IMPORT.is_match(&source) {
            violations.push(format!("{file} imports a library implementation"));
        }
        for library_root in LIBRARY_ROOTS {
            if tokens.iter().any(|list| {
                library_root
                    .iter()
                    .all(|token| list.iter().any(|item| item == token))
            }) {
                violations.push(format!("{file} redraws {}", library_root.join(" ")));
            }
        }
    }
    violations
}
