//! YAML construction, alias copies, and rejected metadata use a fixed stack.

use std::thread;

use serde_json::Value;

use crate::diagnostic::Code;
use crate::discovery::SourceKind;
use crate::{parsing, yaml};

fn small_stack(test: fn()) {
    thread::Builder::new()
        .stack_size(256 * 1024)
        .spawn(test)
        .unwrap()
        .join()
        .unwrap();
}

fn sequence(depth: usize, indent: usize) -> String {
    let mut source = String::new();
    for level in 0..depth {
        source.push_str(&" ".repeat(indent + level));
        source.push_str("-\n");
    }
    source.push_str(&" ".repeat(indent + depth));
    source.push_str("leaf\n");
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

#[test]
fn nested_sequences_keep_the_leaf_and_its_location_through_clone_and_drop() {
    small_stack(|| {
        let document = yaml::parse(&sequence(512, 0), "deep.screen.html", 2).unwrap();
        assert_eq!(leaf(&document.value, 512), "leaf");
        let location = &document.positions[&"/0".repeat(512)];
        assert_eq!((location.line, location.column), (514, 513));
        let cloned = document.clone();
        assert_eq!(leaf(&cloned.value, 512), "leaf");
        assert_eq!(cloned.positions.len(), 513);
    });
}

#[test]
fn nested_aliases_keep_copied_values_and_original_child_locations() {
    small_stack(|| {
        let source = format!("base: &deep\n{}copy: *deep\n", sequence(256, 2));
        let document = yaml::parse(&source, "deep.use-case.yaml", 1).unwrap();
        assert_eq!(leaf(&document.value["base"], 256), "leaf");
        assert_eq!(leaf(&document.value["copy"], 256), "leaf");
        let suffix = "/0".repeat(256);
        assert_eq!(
            document.positions[&format!("/base{suffix}")].line,
            document.positions[&format!("/copy{suffix}")].line
        );
        assert_eq!(document.positions["/copy"].line, 259);
        assert_eq!(document.positions["/copy"].column, 1);
    });
}

#[test]
fn nested_values_are_released_when_document_or_key_validation_fails() {
    small_stack(|| {
        let source = format!("{}---\ntitle: Second\n", sequence(512, 0));
        let issue = yaml::parse(&source, "deep.yaml", 1).unwrap_err();
        assert_eq!(issue.message, "expected one YAML document");
        let source = format!("? {}leaf{}\n: value\n", "[".repeat(128), "]".repeat(128));
        let issue = yaml::parse(&source, "deep.yaml", 1).unwrap_err();
        assert_eq!(issue.code, Code::HtmlFrontMatter);
        assert_eq!(issue.message, "YAML object keys must be strings");
    });
}

#[test]
fn front_matter_validation_releases_unknown_and_recoverable_nested_fields() {
    small_stack(|| {
        let source = format!(
            "---\ntitle: Deep\nunknown:\n{}---\n<p>Body</p>\n",
            sequence(512, 2)
        );
        let issue = parsing::parse(source, "deep.screen.html", SourceKind::Screen).unwrap_err();
        assert_eq!(issue.message, "unknown field unknown");
        for field in ["tags", "props", "propSchema"] {
            let source = format!(
                "---\ntitle: Deep\n{field}:\n{}---\n<p>Body</p>\n",
                sequence(512, 2)
            );
            let parsed = parsing::parse(source, "deep.screen.html", SourceKind::Screen).unwrap();
            assert_eq!(parsed.issues.len(), 1, "{field}");
            assert_eq!(parsed.issues[0].code, Code::HtmlFrontMatter);
            assert!(parsed.issues[0].message.starts_with(field));
        }
    });
}

#[test]
fn duplicate_keys_and_recursive_aliases_keep_their_diagnostics() {
    let issue = yaml::parse(
        "first: &name title\n*name: One\ntitle: Two\n",
        "entry.yaml",
        2,
    )
    .unwrap_err();
    assert_eq!(issue.message, "duplicate key title");
    let location = issue.location.unwrap();
    assert_eq!((location.line, location.column), (4, 1));
    let issue = yaml::parse("entry: &entry [*entry]", "entry.yaml", 1).unwrap_err();
    assert_eq!(issue.message, "unknown or recursive YAML alias");
}
