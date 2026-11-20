//! Public slug value and derivation contract.

#![allow(clippy::unwrap_used)]

use std::collections::BTreeSet;
use std::str::FromStr;

use mkc_domain::slug::{
    APP_FIRST_SEGMENTS, PROJECT_SLUG_MAX_LENGTH, ProjectSlug, SITE_FIRST_SEGMENTS,
    WORKSPACE_SLUG_MAX_LENGTH, WorkspaceSlug, github_reserved_slugs, is_reserved, slugify,
    with_numeric_suffix,
};

#[test]
fn workspace_and_project_slugs_enforce_the_address_grammar() {
    for value in ["a", "team-7", &"a".repeat(39)] {
        assert!(WorkspaceSlug::from_str(value).is_ok(), "{value}");
    }
    for value in ["a", "catalogue-ui", &"p".repeat(100)] {
        assert!(ProjectSlug::from_str(value).is_ok(), "{value}");
    }
    for value in [
        "",
        "Team",
        "-team",
        "team-",
        "team--ui",
        "team_ui",
        "café",
        "00000000-0000-0000-0000-000000000001",
        "00000000000000000000000000000001",
    ] {
        assert!(WorkspaceSlug::from_str(value).is_err(), "{value}");
        assert!(ProjectSlug::from_str(value).is_err(), "{value}");
    }
    assert!(WorkspaceSlug::from_str(&"a".repeat(40)).is_err());
    assert!(ProjectSlug::from_str(&"a".repeat(101)).is_err());
}

#[test]
fn serde_cannot_construct_an_invalid_slug() {
    assert!(serde_json::from_str::<WorkspaceSlug>(r#""Mixed-Case""#).is_err());
    assert!(serde_json::from_str::<ProjectSlug>(r#""project""#).is_ok());
}

#[test]
fn slugification_is_normalized_bounded_and_suffix_safe() {
    assert_eq!(
        slugify("Ｆoo—Bar  7", WORKSPACE_SLUG_MAX_LENGTH),
        "foo-bar-7"
    );
    assert_eq!(slugify("---", WORKSPACE_SLUG_MAX_LENGTH), "");
    assert_eq!(
        slugify(
            &format!("{}!tail", "a".repeat(39)),
            WORKSPACE_SLUG_MAX_LENGTH
        ),
        "a".repeat(39)
    );
    assert_eq!(
        with_numeric_suffix(&"a".repeat(100), 23, PROJECT_SLUG_MAX_LENGTH),
        format!("{}-23", "a".repeat(97))
    );
}

#[test]
fn slugification_does_not_end_with_a_separator_at_the_length_boundary() {
    let workspace_stem = "a".repeat(WORKSPACE_SLUG_MAX_LENGTH - 1);
    assert_eq!(
        slugify(&format!("{workspace_stem} b"), WORKSPACE_SLUG_MAX_LENGTH),
        workspace_stem
    );

    let project_stem = "p".repeat(PROJECT_SLUG_MAX_LENGTH - 1);
    assert_eq!(
        slugify(&format!("{project_stem} q"), PROJECT_SLUG_MAX_LENGTH),
        project_stem
    );
}

#[test]
fn slugification_preserves_grammar_at_each_address_limit() {
    for max_length in [WORKSPACE_SLUG_MAX_LENGTH, PROJECT_SLUG_MAX_LENGTH] {
        let fitting_stem = "a".repeat(max_length - 2);
        let fitting = slugify(&format!("{fitting_stem} B"), max_length);
        assert_eq!(fitting, format!("{fitting_stem}-b"));
        assert_slug_invariants(&fitting, max_length);

        let truncated_stem = "c".repeat(max_length - 1);
        let truncated = slugify(&format!("{truncated_stem} - _ D"), max_length);
        assert_eq!(truncated, truncated_stem);
        assert_slug_invariants(&truncated, max_length);

        let full = "E".repeat(max_length);
        let full = slugify(&format!("{full} f"), max_length);
        assert_eq!(full, "e".repeat(max_length));
        assert_slug_invariants(&full, max_length);
    }
}

fn assert_slug_invariants(value: &str, max_length: usize) {
    assert!((1..=max_length).contains(&value.len()), "{value}");
    assert!(
        value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-'),
        "{value}"
    );
    assert!(!value.starts_with('-'), "{value}");
    assert!(!value.ends_with('-'), "{value}");
    assert!(!value.contains("--"), "{value}");
    if max_length == WORKSPACE_SLUG_MAX_LENGTH {
        assert!(WorkspaceSlug::from_str(value).is_ok(), "{value}");
    } else {
        assert!(ProjectSlug::from_str(value).is_ok(), "{value}");
    }
}

#[test]
fn route_and_policy_names_are_reserved_only_for_workspaces() {
    for value in ["docs", "dashboard", "api", "mokly", "www9", ".well-known"] {
        assert!(is_reserved(value), "{value}");
    }
    assert!(!is_reserved("customer-team"));
    assert!(SITE_FIRST_SEGMENTS.contains(&"robots.txt"));
    assert!(APP_FIRST_SEGMENTS.contains(&"sign-in"));
}

#[test]
fn attributed_policy_seed_is_sorted_unique_and_complete() {
    let names: Vec<_> = github_reserved_slugs().collect();
    let unique: BTreeSet<_> = names.iter().copied().collect();
    assert_eq!(names.len(), 302);
    assert_eq!(names.len(), unique.len());
    assert!(names.windows(2).all(|pair| pair[0] < pair[1]));
    for required in ["300", "admin", "help", "security", "www9"] {
        assert!(unique.contains(required));
        assert!(is_reserved(required));
    }
}
