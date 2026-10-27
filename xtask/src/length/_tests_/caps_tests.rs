//! The reviewed cap table parses into exact caps or names its file and fault.

use crate::length::error::Error;

use super::{ProtocolCaps, parse_cap_table};

const LABEL: &str = "xtask/protocol-document-caps.json";

#[test]
fn a_sorted_json_cap_table_parses_into_exact_caps() {
    let mut expected = ProtocolCaps::default();
    expected.insert("a.md".to_owned(), 251);
    expected.insert("nested/b.md".to_owned(), 300);
    assert_eq!(
        parse_cap_table(b"{\n  \"a.md\": 251,\n  \"nested/b.md\": 300\n}\n", LABEL).unwrap(),
        expected
    );
    assert_eq!(
        parse_cap_table(b"{}\n", LABEL).unwrap(),
        ProtocolCaps::default()
    );
}

#[test]
fn a_cap_table_fault_fails_with_the_file_label() {
    let cases: [(&str, &str, &str); 16] = [
        (
            "unsorted keys",
            r#"{ "b.md": 300, "a.md": 300 }"#,
            "not sorted: a.md",
        ),
        (
            "a repeated key",
            r#"{ "a.md": 300, "a.md": 301 }"#,
            "repeats the cap for a.md",
        ),
        (
            "an escaped repeat",
            r#"{ "a.md": 300, "a\u002emd": 301 }"#,
            "repeats",
        ),
        (
            "a fractional cap",
            r#"{ "a.md": 300.5 }"#,
            "invalid cap for a.md",
        ),
        (
            "a string cap",
            r#"{ "a.md": "300" }"#,
            "invalid cap for a.md",
        ),
        (
            "an unsafe cap",
            r#"{ "a.md": 9007199254740993 }"#,
            "invalid cap",
        ),
        ("a cap at 250", r#"{ "a.md": 250 }"#, "invalid cap for a.md"),
        (
            "a cap below 250",
            r#"{ "a.md": 120 }"#,
            "invalid cap for a.md",
        ),
        (
            "an array document",
            r#"[{ "a.md": 300 }]"#,
            "one JSON object",
        ),
        ("a null document", "null", "one JSON object"),
        ("a number document", "300", "one JSON object"),
        (
            "a parent path key",
            r#"{ "../README.md": 300 }"#,
            "docs/protocol",
        ),
        (
            "an absolute path key",
            r#"{ "/a.md": 300 }"#,
            "docs/protocol",
        ),
        (
            "an empty segment key",
            r#"{ "nested//a.md": 300 }"#,
            "docs/protocol",
        ),
        ("a non-Markdown key", r#"{ "a.txt": 300 }"#, "docs/protocol"),
        ("invalid JSON", r#"{ "a.md": 300, }"#, "not valid JSON"),
    ];
    for (name, source, reason) in cases {
        let error = parse_cap_table(source.as_bytes(), LABEL).unwrap_err();
        let message = error.to_string();
        let message = message.strip_prefix("[xtask/length] ").unwrap_or(&message);
        assert!(
            message.starts_with(&format!("{LABEL} ")),
            "{name}: {message}"
        );
        assert!(message.contains(reason), "{name}: {message}");
        if name == "a repeated key" {
            assert!(message.ends_with("a.md"), "{name}: {message}");
        }
        assert!(
            !matches!(error, Error::SourceFileLength { .. } | Error::ProtocolCaps),
            "{name}"
        );
    }
}
