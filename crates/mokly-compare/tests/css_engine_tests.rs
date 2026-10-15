//! CSS and opaque resources use actual graph reachability and component ownership.

use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::ReviewState;

#[expect(
    dead_code,
    reason = "the shared Git fixture also exposes relocation for move tests"
)]
mod engine_support;

use engine_support::{Fixture, entry};

#[test]
fn linked_rules_change_components_from_own_pages_and_leave_consumers_affected() {
    let fixture = Fixture::new(&[
        (
            "mokly.config.json",
            "{\"stylesheets\":[{\"match\":\"**\",\"stylesheets\":[\"styles.css\"]}]}",
        ),
        ("styles.css", ".card { color: red } .absent { color: red }"),
        (
            "specs/card.component.html",
            "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<article class=\"card\">Card</article>",
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<ui-card></ui-card>",
        ),
        (
            "specs/empty.screen.html",
            "---\ntitle: Empty\n---\n<p>Empty</p>",
        ),
    ]);
    fixture.edit(
        "styles.css",
        ".card { color: blue } .absent { color: green }",
    );
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["card"]);
    assert_eq!(result.review.affected[0].consumer.path, "home");
    for path in ["card", "home"] {
        let rules = &entry(&result, path).views[0].rules;
        assert_eq!(rules.len(), 1);
        assert_eq!(
            rules[0].owner,
            EvidenceOwner::Component {
                path: "card".into()
            }
        );
        assert_eq!(rules[0].selector, ".card");
    }
    assert_eq!(
        entry(&result, "empty").views[0].rules[0].status,
        RuleStatus::Excluded
    );
    assert_eq!(entry(&result, "empty").views[0].rules[0].selector, "");
    assert_eq!(
        entry(&result, "home").views[0].state,
        ReviewState::Unchanged
    );
}

#[test]
fn nested_own_page_filtering_uses_unfiltered_sets_before_page_membership() {
    let fixture = Fixture::new(&[
        (
            "mokly.config.json",
            "{\"stylesheets\":[{\"match\":\"**\",\"stylesheets\":[\"styles.css\"]}]}",
        ),
        ("styles.css", ".leaf { color: red }"),
        (
            "specs/leaf.component.html",
            "---\ntitle: Leaf\nelement: ui-leaf\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<span class=\"leaf\">Leaf</span>",
        ),
        (
            "specs/parent.component.html",
            "---\ntitle: Parent\nelement: ui-parent\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<section><ui-leaf></ui-leaf></section>",
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<ui-parent></ui-parent>",
        ),
    ]);
    fixture.edit("styles.css", ".leaf { color: blue }");
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["leaf"]);
    assert!(!entry(&result, "parent").included);
    assert_eq!(result.review.affected.len(), 2);
    assert!(
        result
            .review
            .affected
            .iter()
            .any(|consumer| consumer.consumer.path == "home")
    );
    assert!(
        result
            .review
            .affected
            .iter()
            .any(|consumer| consumer.consumer.path == "parent")
    );
}

#[test]
fn ignored_links_speculative_hints_and_unreferenced_assets_supply_no_evidence() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<mokly-ignore id=\"chrome\"><img src=\"../../ignored.svg\"></mokly-ignore><link rel=\"prefetch\" href=\"../../prefetch.svg\"><p>Home</p>",
        ),
        ("ignored.svg", "before"),
        ("unreferenced.svg", "before"),
        ("prefetch.svg", "before"),
    ]);
    fixture.edit("ignored.svg", "after");
    fixture.edit("unreferenced.svg", "after");
    fixture.edit("prefetch.svg", "after");
    let result = fixture.compare().unwrap();
    assert!(result.snapshot.changed_entries.is_empty());
    assert!(entry(&result, "home").views[0].resources.is_empty());
}

#[test]
fn referenced_resource_edits_and_verified_deletions_stay_ready() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<img src=\"../../image.svg\"><img src=\"../../second.svg\">",
        ),
        ("image.svg", "before"),
        ("second.svg", "before"),
    ]);
    fixture.edit("image.svg", "after");
    fixture.remove("second.svg");
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["home"]);
    assert_eq!(entry(&result, "home").views[0].resources.len(), 2);
    assert!(
        entry(&result, "home").views[0]
            .resources
            .iter()
            .all(|resource| resource.owner == EvidenceOwner::Entry)
    );
    fixture.remove("image.svg");
    assert!(fixture.compare().is_ok());
}

#[test]
fn formatting_only_css_and_screen_only_matches_do_not_invent_component_impact() {
    let fixture = Fixture::new(&[
        (
            "mokly.config.json",
            "{\"stylesheets\":[{\"match\":\"**\",\"stylesheets\":[\"styles.css\"]}]}",
        ),
        ("styles.css", ".consumer .card { color: red }"),
        (
            "specs/card.component.html",
            "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<article class=\"card\">Card</article>",
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<main class=\"consumer\"><ui-card></ui-card></main>",
        ),
    ]);
    fixture.edit("styles.css", "/* comment */ .consumer .card{color:red}\n");
    assert!(
        fixture
            .compare()
            .unwrap()
            .snapshot
            .changed_entries
            .is_empty()
    );
    fixture.edit("styles.css", ".consumer .card { color: blue }");
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["home"]);
    assert!(result.review.affected.is_empty());
    assert_eq!(
        entry(&result, "home").views[0].rules[0].owner,
        EvidenceOwner::Entry
    );
}
