//! The YAML builder bounds authored nesting and keeps it on the heap.
//!
//! A value may sit at most [`MAX_DEPTH`] levels below the root, and a deeper
//! one fails where it starts. Each test runs on a 256 KiB thread, an eighth of
//! the 2 MiB worker stacks.

use std::thread;

use serde_json::Value;

use crate::diagnostic::Code;
use crate::discovery::SourceKind;
use crate::yaml_limits::MAX_DEPTH;
use crate::{parsing, yaml};

const STACK: usize = 256 * 1024;
/// Far past the limit, so the builder must stop before it reads this deep.
const DEEP: usize = 100_000;
const TOO_DEEP: &str = "YAML value exceeds 128 nesting levels; reduce its nesting";

fn small_stack(test: fn()) {
    thread::Builder::new()
        .stack_size(STACK)
        .spawn(test)
        .unwrap()
        .join()
        .unwrap();
}

/// `depth` nested block sequences on one line, ending in a scalar.
fn sequences(depth: usize) -> String {
    format!("{}leaf\n", "- ".repeat(depth))
}

/// `depth` nested flow sequences around a scalar.
fn flow(depth: usize) -> String {
    format!("{}leaf{}\n", "[".repeat(depth), "]".repeat(depth))
}

/// `depth` nested mappings, each with the key `k`, ending in a scalar.
fn mappings(depth: usize) -> String {
    let mut source = String::new();
    for level in 0..depth {
        source.push_str(&format!("{}k:\n", " ".repeat(level)));
    }
    source.push_str(&format!("{}leaf\n", " ".repeat(depth)));
    source
}

fn leaf(mut value: &Value, depth: usize) -> &str {
    for _ in 0..depth {
        let values = value.as_array().unwrap();
        assert_eq!(values.len(), 1);
        value = &values[0];
    }
    value.as_str().unwrap()
}

/// Assert that `source` fails with the depth message at `line` and `column`.
fn too_deep(source: &str, line: usize, column: usize) {
    let issue = yaml::parse(source, "deep.yaml", 1).unwrap_err();
    assert_eq!(
        (issue.code, issue.message.as_str()),
        (Code::HtmlFrontMatter, TOO_DEEP)
    );
    let location = issue.location.unwrap();
    assert_eq!((location.line, location.column), (line, column));
}

#[test]
fn values_at_the_limit_keep_the_leaf_and_its_location() {
    small_stack(|| {
        let document = yaml::parse(&sequences(MAX_DEPTH), "deep.yaml", 1).unwrap();
        assert_eq!(leaf(&document.value, MAX_DEPTH), "leaf");
        let location = document.positions.get(&"/0".repeat(MAX_DEPTH)).unwrap();
        assert_eq!((location.line, location.column), (1, 2 * MAX_DEPTH + 1));
        let copy = document.clone();
        assert_eq!(leaf(&copy.value, MAX_DEPTH), "leaf");
        let document = yaml::parse(&flow(MAX_DEPTH), "deep.yaml", 1).unwrap();
        assert_eq!(leaf(&document.value, MAX_DEPTH), "leaf");
    });
}

#[test]
fn mappings_at_the_limit_take_their_key_locations() {
    small_stack(|| {
        let document = yaml::parse(&mappings(MAX_DEPTH), "deep.yaml", 2).unwrap();
        let mut value = &document.value;
        for _ in 0..MAX_DEPTH {
            value = &value["k"];
        }
        assert_eq!(value, "leaf");
        let location = document.positions.get(&"/k".repeat(MAX_DEPTH)).unwrap();
        assert_eq!((location.line, location.column), (MAX_DEPTH + 1, MAX_DEPTH));
    });
}

#[test]
fn a_value_past_the_limit_fails_where_it_starts() {
    small_stack(|| {
        let depth = MAX_DEPTH + 1;
        too_deep(&sequences(depth), 1, 2 * depth + 1);
        too_deep(&format!("{}[]\n", "- ".repeat(depth)), 1, 2 * depth + 1);
        too_deep(&flow(depth), 1, depth + 1);
        too_deep(&mappings(depth), depth, depth);
    });
}

/// Block nesting stops at the builder's limit. The parser reads flow nesting
/// ahead, so it stops flow nesting past 255 levels with its own message.
#[test]
fn deep_input_stops_at_the_limit() {
    small_stack(|| {
        too_deep(&sequences(DEEP), 1, 2 * (MAX_DEPTH + 1) + 1);
        let issue = yaml::parse(&flow(DEEP), "deep.yaml", 1).unwrap_err();
        let failure = (issue.code, issue.message.as_str());
        assert_eq!(failure, (Code::HtmlFrontMatter, "recursion limit exceeded"));
        let location = issue.location.unwrap();
        assert_eq!((location.line, location.column), (1, 256));
    });
}

#[test]
fn aliases_count_at_the_depth_of_their_deepest_copy() {
    small_stack(|| {
        let depth = MAX_DEPTH - 1;
        let source = format!("base: &deep\n  {}copy: *deep\n", sequences(depth));
        let document = yaml::parse(&source, "deep.yaml", 1).unwrap();
        assert_eq!(leaf(&document.value["base"], depth), "leaf");
        assert_eq!(leaf(&document.value["copy"], depth), "leaf");
        let suffix = "/0".repeat(depth);
        let base = document.positions.get(&format!("/base{suffix}")).unwrap();
        let copy = document.positions.get(&format!("/copy{suffix}")).unwrap();
        assert_eq!((copy.line, copy.column), (base.line, base.column));
        let alias = document.positions.get("/copy").unwrap();
        assert_eq!((alias.line, alias.column), (3, 1));
        let nested = format!("base: &deep\n  {}copy:\n- *deep\n", sequences(depth));
        too_deep(&nested, 4, 3);
    });
}

#[test]
fn rejected_documents_release_their_values() {
    small_stack(|| {
        let second = format!("{}---\ntitle: Second\n", sequences(MAX_DEPTH));
        let issue = yaml::parse(&second, "deep.yaml", 1).unwrap_err();
        assert_eq!(issue.message, "expected one YAML document");
        let key = format!("? {}: value\n", sequences(MAX_DEPTH - 1));
        let issue = yaml::parse(&key, "deep.yaml", 1).unwrap_err();
        assert_eq!(issue.message, "YAML object keys must be strings");
        let location = issue.location.unwrap();
        assert_eq!((location.line, location.column), (1, 3));
        let duplicate = format!("a:\n  {}a: 1\n", sequences(MAX_DEPTH - 1));
        let issue = yaml::parse(&duplicate, "deep.yaml", 1).unwrap_err();
        assert_eq!(issue.message, "duplicate key a");
    });
}

#[test]
fn front_matter_fields_fail_on_their_own_rules_up_to_the_limit() {
    small_stack(|| {
        let deep = format!("  {}", sequences(MAX_DEPTH - 1));
        let source = format!("---\ntitle: Deep\nextra:\n{deep}---\n<p>Body</p>\n");
        let issue = parsing::parse(source, "deep.screen.html", SourceKind::Screen).unwrap_err();
        assert_eq!(issue.message, "unknown field extra");
        for field in ["tags", "propSchema"] {
            let source = format!("---\ntitle: Deep\n{field}:\n{deep}---\n<p>Body</p>\n");
            let parsed = parsing::parse(source, "deep.screen.html", SourceKind::Screen).unwrap();
            assert_eq!(parsed.issues.len(), 1, "{field}");
            assert_eq!(parsed.issues[0].code, Code::HtmlFrontMatter);
            assert!(parsed.issues[0].message.starts_with(field));
        }
        let deeper = format!("  {}", sequences(MAX_DEPTH));
        let source = format!("---\ntitle: Deep\nextra:\n{deeper}---\n<p>Body</p>\n");
        let issue = parsing::parse(source, "deep.screen.html", SourceKind::Screen).unwrap_err();
        assert_eq!(issue.message, TOO_DEEP);
        let location = issue.location.unwrap();
        assert_eq!((location.line, location.column), (4, 2 * MAX_DEPTH + 3));
    });
}
