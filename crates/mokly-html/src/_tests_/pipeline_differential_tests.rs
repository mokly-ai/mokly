//! Tracked fixtures parse to the reference tree, and each keeps an exact position table.

use std::fmt::Write;
use std::fs;
use std::path::Path;

use crate::support::{authored, legacy_authored_document};
use crate::tree::{self, Node};

/// The number of tracked fixture files; a lost file fails the test.
const FIXTURES: usize = 55;

fn fixtures() -> Vec<(String, String)> {
    let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/differential");
    let mut fixtures: Vec<_> = fs::read_dir(directory)
        .expect("differential fixtures must be readable")
        .map(|entry| {
            let path = entry.expect("fixture entry").path();
            let name = path
                .file_stem()
                .and_then(|stem| stem.to_str())
                .expect("fixture name")
                .to_owned();
            let source = fs::read_to_string(&path).expect("fixture must be UTF-8");
            (name, source)
        })
        .collect();
    fixtures.sort();
    fixtures
}

/// One line per element in tree order, indented by depth: its name and `line:column`, or `-`.
fn position_table(nodes: &[Node]) -> String {
    let mut table = String::new();
    let mut pending: Vec<_> = nodes.iter().rev().map(|node| (node, 0)).collect();
    while let Some((node, depth)) = pending.pop() {
        let depth = match node {
            Node::Element(element) => {
                let position = element.source.as_ref().map_or_else(
                    || "-".to_owned(),
                    |source| format!("{}:{}", source.line, source.column),
                );
                let _ = writeln!(table, "{}{} {position}", "  ".repeat(depth), element.name);
                depth + 1
            }
            _ => depth,
        };
        pending.extend(node.children().iter().rev().map(|child| (child, depth)));
    }
    table
}

fn strip_positions(nodes: &mut [Node]) {
    let mut pending: Vec<_> = nodes.iter_mut().collect();
    while let Some(node) = pending.pop() {
        if let Node::Element(element) = node {
            element.source = None;
            element.origin = None;
        }
        if let Some(children) = node.children_mut() {
            pending.extend(children.iter_mut());
        }
    }
}

fn check(name: &str, source: &str) {
    let mut nodes = authored(source, &format!("fixtures/{name}.html"), true);
    insta::assert_snapshot!(name, position_table(&nodes));
    strip_positions(&mut nodes);
    assert!(nodes == legacy_authored_document(source), "{name}");
}

fn srcdoc(source: &str) -> String {
    let escaped = source
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;");
    format!("<iframe srcdoc=\"{escaped}\"></iframe>")
}

#[test]
fn tracked_fixtures_match_the_reference_parser_with_exact_positions() {
    let fixtures = fixtures();
    assert_eq!(fixtures.len(), FIXTURES);
    for (name, source) in &fixtures {
        check(name, source);
        if name.starts_with("script-data-") {
            let wrapper = srcdoc(source);
            check(&format!("{name}-srcdoc"), &wrapper);
            let decoded =
                tree::walk(&legacy_authored_document(&wrapper)).find_map(|node| match node {
                    Node::Element(element) if element.name == "iframe" => {
                        element.get("srcdoc").map(str::to_owned)
                    }
                    _ => None,
                });
            assert_eq!(decoded.as_deref(), Some(source.as_str()), "{name}");
        }
    }
}
