//! Public resource validation never substitutes current or invalid historical material.

use std::fs;

use mokly_model::evidence::RuleStatus;

#[expect(
    dead_code,
    reason = "the shared Git fixture exposes relocation for move tests"
)]
mod engine_support;

use engine_support::{Fixture, entry};

#[test]
fn a_changed_resource_does_not_skip_a_later_invalid_reference() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<img src=\"../../first.svg\"><img src=\"../../second.svg\">",
        ),
        ("first.svg", "before"),
        ("second.svg", "before"),
    ]);
    fixture.edit("first.svg", "after");
    fixture.edit(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<img src=\"../../first.svg\"><img src=\"../../missing.svg\">",
    );
    assert!(fixture.compare().is_err());
}

#[test]
fn a_directory_replacing_a_regular_resource_is_not_a_verified_deletion() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<img src=\"../../image.svg\">",
        ),
        ("image.svg", "before"),
    ]);
    fixture.remove("image.svg");
    fs::create_dir(fixture.directory.path().join("image.svg")).unwrap();
    assert!(fixture.compare().is_err());
}

#[cfg(unix)]
#[test]
fn a_dangling_symlink_replacing_a_regular_resource_cannot_supply_deletion_proof() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<img src=\"../../image.svg\">",
        ),
        ("image.svg", "before"),
    ]);
    fixture.remove("image.svg");
    std::os::unix::fs::symlink("missing.svg", fixture.directory.path().join("image.svg")).unwrap();
    assert!(fixture.compare().is_err());
}

#[test]
fn public_css_parse_failures_are_unresolved_without_partial_selector_claims() {
    let fixture = Fixture::new(&[
        (
            "specs/reference.page.html",
            "---\ntitle: Reference\n---\n<!doctype html><html><head><title>Reference</title><link rel=\"stylesheet\" href=\"../../theme.css\"></head><body><p class=\"x\">Text</p></body></html>",
        ),
        ("theme.css", ".x{color:red}"),
    ]);
    fixture.edit("theme.css", ".x { color:blue; /*");
    let result = fixture.compare().unwrap();
    let page = result
        .entries
        .iter()
        .find(|entry| entry.path == "reference")
        .unwrap();
    assert!(page.included);
    assert_eq!(page.documents[0].evidence.rules.len(), 1);
    assert_eq!(page.documents[0].evidence.rules[0].selector, "");
    assert_eq!(
        page.documents[0].evidence.rules[0].status,
        RuleStatus::Unresolved
    );
}

#[test]
fn an_embedded_stylesheet_matches_its_own_document_and_cannot_match_the_host() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<main class=\"host\"><iframe src=\"../../embedded.html\"></iframe></main>",
        ),
        (
            "embedded.html",
            "<!doctype html><html><head><link rel=\"stylesheet\" href=\"embedded.css\"></head><body><p class=\"inside\">Embedded</p></body></html>",
        ),
        ("embedded.css", ".host{color:red}.inside{color:red}"),
    ]);
    fixture.edit("embedded.css", ".host{color:blue}.inside{color:red}");
    let result = fixture.compare().unwrap();
    assert!(!entry(&result, "home").included);
    assert_eq!(
        entry(&result, "home").views[0].rules[0].status,
        RuleStatus::Excluded
    );
    fixture.edit("embedded.css", ".host{color:red}.inside{color:blue}");
    let result = fixture.compare().unwrap();
    assert!(entry(&result, "home").included);
    assert_eq!(entry(&result, "home").views[0].rules[0].selector, ".inside");
}
