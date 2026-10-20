//! The YAML builder and front-matter validation keep authored nesting on the heap.
//!
//! Each test runs on a 256 KiB thread, an eighth of the 2 MiB worker stacks,
//! with nesting that a recursive builder could not survive on that stack.

use std::thread;

use serde_json::Value;

use crate::diagnostic::Code;
use crate::discovery::SourceKind;
use crate::{parsing, yaml};

const STACK: usize = 256 * 1024;
const DEPTH: usize = 100_000;

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

fn leaf(mut value: &Value, depth: usize) -> &str {
    for _ in 0..depth {
        let values = value.as_array().unwrap();
        assert_eq!(values.len(), 1);
        value = &values[0];
    }
    value.as_str().unwrap()
}

#[test]
fn deep_sequences_keep_the_leaf_and_its_location() {
    small_stack(|| {
        let document = yaml::parse(&sequences(DEPTH), "deep.yaml", 1).unwrap();
        assert_eq!(leaf(&document.value, DEPTH), "leaf");
        let location = document.positions.get(&"/0".repeat(DEPTH)).unwrap();
        assert_eq!((location.line, location.column), (1, 2 * DEPTH + 1));
        let copy = document.clone();
        assert_eq!(leaf(&copy.value, DEPTH), "leaf");
    });
}

#[test]
fn deep_mappings_take_their_key_locations() {
    small_stack(|| {
        let depth = 1_000;
        let mut source = String::new();
        for level in 0..depth {
            source.push_str(&format!("{}k:\n", " ".repeat(level)));
        }
        source.push_str(&format!("{}leaf\n", " ".repeat(depth)));
        let document = yaml::parse(&source, "deep.yaml", 2).unwrap();
        let mut value = &document.value;
        for _ in 0..depth {
            value = &value["k"];
        }
        assert_eq!(value, "leaf");
        let location = document.positions.get(&"/k".repeat(depth)).unwrap();
        assert_eq!((location.line, location.column), (depth + 1, depth));
    });
}

#[test]
fn deep_aliases_copy_values_and_original_child_locations() {
    small_stack(|| {
        let source = format!("base: &deep\n  {}copy: *deep\n", sequences(DEPTH));
        let document = yaml::parse(&source, "deep.yaml", 1).unwrap();
        assert_eq!(leaf(&document.value["base"], DEPTH), "leaf");
        assert_eq!(leaf(&document.value["copy"], DEPTH), "leaf");
        let suffix = "/0".repeat(DEPTH);
        let base = document.positions.get(&format!("/base{suffix}")).unwrap();
        let copy = document.positions.get(&format!("/copy{suffix}")).unwrap();
        assert_eq!((copy.line, copy.column), (base.line, base.column));
        let alias = document.positions.get("/copy").unwrap();
        assert_eq!((alias.line, alias.column), (3, 1));
    });
}

#[test]
fn rejected_documents_release_deep_values() {
    small_stack(|| {
        let second = format!("{}---\ntitle: Second\n", sequences(DEPTH));
        let issue = yaml::parse(&second, "deep.yaml", 1).unwrap_err();
        assert_eq!(issue.message, "expected one YAML document");
        let key = format!("? {}: value\n", sequences(DEPTH));
        let issue = yaml::parse(&key, "deep.yaml", 1).unwrap_err();
        assert_eq!(issue.message, "YAML object keys must be strings");
        let location = issue.location.unwrap();
        assert_eq!((location.line, location.column), (1, 3));
        let duplicate = format!("a:\n  {}a: 1\n", sequences(DEPTH));
        let issue = yaml::parse(&duplicate, "deep.yaml", 1).unwrap_err();
        assert_eq!(issue.message, "duplicate key a");
    });
}

#[test]
fn front_matter_validation_releases_deep_fields() {
    small_stack(|| {
        let deep = format!("  {}", sequences(DEPTH));
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
    });
}
