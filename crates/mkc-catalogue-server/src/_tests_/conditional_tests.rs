//! Entity-tag list validation and weak comparison behavior.

use super::matches;

const HASH: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

#[test]
fn wildcard_weak_strong_and_list_members_match_the_same_opaque_tag() {
    for value in [
        "*",
        " * \t",
        &format!("W/\"{HASH}\""),
        &format!("\"{HASH}\""),
        &format!("\"other\", W/\"{HASH}\", \"last\""),
        &format!("\"opaque,comma\", \"{HASH}\""),
    ] {
        assert!(matches(value, HASH), "{value}");
    }
}

#[test]
fn valid_nonmatching_lists_do_not_match() {
    for value in [
        "\"other\"",
        "W/\"other\"",
        "\"first\", W/\"second\"",
        "\"\"",
    ] {
        assert!(!matches(value, HASH), "{value}");
    }
}

#[test]
fn malformed_conditionals_are_ignored_even_if_one_member_would_match() {
    for value in [
        "",
        "   ",
        "*, \"other\"",
        "w/\"other\"",
        "other",
        "W/other",
        "\"unterminated",
        "\"other\" trailing",
        "\"other\",",
        ",\"other\"",
        "\"other\", invalid",
        &format!("\"{HASH}\", invalid"),
        "\"bad\u{7f}tag\"",
    ] {
        assert!(!matches(value, HASH), "{value:?}");
    }
}
