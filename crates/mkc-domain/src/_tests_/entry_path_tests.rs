//! Entry-path values validate construction and JSON decoding without normalization.

#![allow(clippy::unwrap_used, clippy::panic)]

use crate::entry_path::{EntryPath, entry_path};

#[test]
fn entry_paths_preserve_case_and_portable_segments() {
    for path in [
        "a",
        "Screen_1",
        "a--b",
        "-a",
        "a-",
        "com10",
        "lpt0",
        "a/mokly-generated",
        "product/node_modules/example",
    ] {
        assert!(entry_path(path), "{path}");
    }
    for path in [
        "",
        "/a",
        "a/",
        "a//b",
        "a.b",
        "a%2fb",
        "con",
        "AUX",
        "a/COM1",
        "lpt9",
        "prn",
        "Mokly-Generated/a",
    ] {
        assert!(!entry_path(path), "{path}");
    }
}

#[test]
fn the_domain_grammar_is_independent_of_the_cloud_selection_quota() {
    let long = "a".repeat(2049);
    assert!(entry_path(&long));
    assert!(!EntryPath::is_valid(&long));
    for path in [
        "Product/Screen_1",
        "a/mokly-generated",
        "node_modules/_entry",
    ] {
        assert!(entry_path(path));
    }
    for path in ["a/COM9", "Mokly-Generated/a", "a//b", "é"] {
        assert!(!entry_path(path));
    }
}

#[test]
fn construction_and_deserialization_enforce_grammar_and_the_byte_bound() {
    for (value, valid) in [
        ("Product/Screen_1".to_owned(), true),
        ("a".repeat(2048), true),
        ("a".repeat(2049), false),
        ("".into(), false),
        ("a//b".into(), false),
        ("a/CON".into(), false),
        ("Mokly-Generated/a".into(), false),
        ("a/mokly-generated".into(), true),
        ("é".into(), false),
    ] {
        assert_eq!(value.parse::<EntryPath>().is_ok(), valid);
        assert_eq!(EntryPath::try_from(value.clone()).is_ok(), valid);
        let encoded = serde_json::to_string(&value).unwrap();
        assert_eq!(serde_json::from_str::<EntryPath>(&encoded).is_ok(), valid);
    }
    let path: EntryPath = "Product/Screen_1".parse().unwrap();
    assert_eq!(path.as_str(), "Product/Screen_1");
    assert_eq!(
        serde_json::to_string(&path).unwrap(),
        "\"Product/Screen_1\""
    );
}
