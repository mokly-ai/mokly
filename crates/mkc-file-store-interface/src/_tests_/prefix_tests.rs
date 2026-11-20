//! Exact object namespace grammar and length boundaries.

#![allow(clippy::unwrap_used)]

use crate::prefix::{Error, ObjectPrefix};

#[test]
fn accepts_every_allowed_character_without_normalization() {
    for value in [
        "a".to_owned(),
        "0".to_owned(),
        "-".to_owned(),
        "pr-123".to_owned(),
        "-abcdefghijklmnopqrstuvwxyz0123456789-".to_owned(),
        "a".repeat(63),
        "-".repeat(63),
    ] {
        assert_eq!(value.parse::<ObjectPrefix>().unwrap().as_str(), value);
    }
}

#[test]
fn rejects_empty_oversized_or_noncanonical_segments() {
    for value in [
        String::new(),
        "a".repeat(64),
        "PR-1".to_owned(),
        "pr_1".to_owned(),
        "pr.1".to_owned(),
        "pr/1".to_owned(),
        "pr-1/".to_owned(),
        "../pr-1".to_owned(),
        "pr%2f1".to_owned(),
        " ".to_owned(),
        " pr-1".to_owned(),
        "pr-1 ".to_owned(),
        "pr\n1".to_owned(),
        "pr\t1".to_owned(),
        "pré-1".to_owned(),
        "pr-１".to_owned(),
    ] {
        assert_eq!(
            value.parse::<ObjectPrefix>(),
            Err(Error::Invalid),
            "{value:?}"
        );
    }
}
