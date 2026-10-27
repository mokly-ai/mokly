//! Physical line counts and the limit of each scoped file.

use super::super::caps::ProtocolCaps;
use super::{allowed_lines, count_physical_lines, is_audited_path, length_finding};

#[test]
fn physical_line_counts_normalize_crlf_without_counting_a_final_newline() {
    assert_eq!(count_physical_lines(b""), 0);
    assert_eq!(count_physical_lines(b"one"), 1);
    assert_eq!(count_physical_lines(b"one\n"), 1);
    assert_eq!(count_physical_lines(b"one\r\ntwo\r\n"), 2);
}

#[test]
fn protocol_pages_take_their_cap_or_250_lines_and_code_takes_300() {
    let mut caps = ProtocolCaps::default();
    caps.insert("long.md".to_owned(), 260);
    assert_eq!(allowed_lines("docs/protocol/long.md", &caps), 260);
    assert_eq!(allowed_lines("docs/protocol/short.md", &caps), 250);
    assert_eq!(allowed_lines("docs/protocol/script.ts", &caps), 300);
    assert_eq!(allowed_lines("README.md", &caps), 300);
    assert_eq!(
        length_finding("docs/protocol/long.md", &b"x\n".repeat(261), &caps),
        Some("docs/protocol/long.md: 261 lines (limit 260)".to_owned())
    );
    assert_eq!(length_finding("src/a.ts", &b"x\n".repeat(300), &caps), None);
}

#[test]
fn the_audit_covers_every_javascript_extension_and_protocol_markdown() {
    for file in [
        "a.ts",
        "a.tsx",
        "a.js",
        "a.jsx",
        "a.mjs",
        "a.cjs",
        "a.mts",
        "a.cts",
        "docs/protocol/a.md",
        "docs/protocol/nested/b.md",
    ] {
        assert!(is_audited_path(file), "{file}");
    }
    for file in [
        "README.md",
        "docs/guides/a.md",
        "a.rs",
        "a.json",
        "docs/protocol/a.txt",
    ] {
        assert!(!is_audited_path(file), "{file}");
    }
}
