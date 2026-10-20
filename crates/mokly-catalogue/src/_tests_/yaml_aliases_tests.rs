//! The alias scan counts expanded nodes exactly and leaves earlier failures to
//! the builder.

use std::collections::BTreeSet;

use crate::yaml;
use crate::yaml_aliases::scan;
use crate::yaml_limits::{MAX_ALIAS_NODES, MAX_DEPTH};

const OVER_BUDGET: &str = "YAML aliases exceed 1000000 expanded nodes; use fewer aliases";

/// The 1-based line and 0-based column where the scan stops `text`.
fn stop(text: &str, budget: usize) -> (usize, usize) {
    let marker = scan(text, budget).unwrap_err();
    (marker.line(), marker.col())
}

/// Ten anchors, each a sequence of ten aliases of the one before, which would
/// expand to about ten billion nodes.
fn laughs() -> String {
    let mut text = format!("a: &a [{}]\n", ["x"; 10].join(", "));
    for (previous, name) in ('a'..'j').zip('b'..='j') {
        let aliases = vec![format!("*{previous}"); 10].join(", ");
        text.push_str(&format!("{name}: &{name} [{aliases}]\n"));
    }
    text
}

#[test]
fn an_alias_expands_to_every_node_of_its_anchor_keys_included() {
    let text = "a: &a [1, {k: v}]\nb: *a\n";
    assert_eq!(scan(text, 5).unwrap(), BTreeSet::from([1]));
    assert_eq!(stop(text, 4), (2, 3));
}

#[test]
fn nested_anchors_count_the_nodes_that_their_own_aliases_expand_to() {
    let text = "a: &a [x, x]\nb: &b [*a, *a]\nc: *b\n";
    assert!(scan(text, 13).is_ok());
    assert_eq!(stop(text, 12), (3, 3));
}

#[test]
fn the_budget_admits_exactly_the_production_bound() {
    let anchor = ["x"; 999].join(", ");
    let aliases = "- *a\n".repeat(1_000);
    let text = format!("s: &s 1\na: &a [{anchor}]\nb:\n{aliases}");
    assert!(scan(&text, MAX_ALIAS_NODES).is_ok());
    let over = format!("{text}c: *s\n");
    assert_eq!(stop(&over, MAX_ALIAS_NODES), (1_004, 3));
}

#[test]
fn exponential_aliases_fail_before_any_copy() {
    let issue = yaml::parse(&laughs(), "laughs.yaml", 1).unwrap_err();
    assert_eq!(issue.message, OVER_BUDGET);
    let location = issue.location.unwrap();
    assert_eq!((location.line, location.column), (6, 36));
}

#[test]
fn only_anchors_that_an_alias_refers_to_are_named() {
    let text = "a: &a 1\nb: &b [2]\nc: *b\nd: *b\n";
    assert_eq!(scan(text, 4).unwrap(), BTreeSet::from([2]));
}

#[test]
fn the_scan_leaves_earlier_failures_to_the_builder() {
    let deep = format!(
        "deep: {}x{}\n",
        "[".repeat(MAX_DEPTH),
        "]".repeat(MAX_DEPTH)
    );
    let issue = yaml::parse(&format!("{deep}{}", laughs()), "deep.yaml", 1).unwrap_err();
    assert_eq!(
        issue.message,
        "YAML value exceeds 128 nesting levels; reduce its nesting"
    );
    let second = format!("title: First\n---\n{}", laughs());
    let issue = yaml::parse(&second, "second.yaml", 1).unwrap_err();
    assert_eq!(issue.message, "expected one YAML document");
    let unknown = format!("first: *nope\n{}", laughs());
    let issue = yaml::parse(&unknown, "unknown.yaml", 1).unwrap_err();
    assert_eq!(issue.message, "while parsing node, found unknown anchor");
}
