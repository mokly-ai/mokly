//! Inline rule ownership requires own-page proof and follows slot input ownership.

use mokly_model::evidence::EvidenceOwner;
use mokly_model::review::EntryChangeReason;

#[expect(dead_code, reason = "these fixtures edit sources without moving them")]
mod engine_support;
use engine_support::{Fixture, entry};

const CARD: &str = "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children]\n---\n<article><h2 class=\"card-title\">Card</h2><slot></slot></article>";

fn page(selector: &str, color: &str, style_attributes: &str) -> String {
    format!(
        "---\ntitle: Page\n---\n<!doctype html><html><head><style {style_attributes}>{selector}{{color:{color}}}</style></head><body><ui-card><p class=\"mine\">Caller</p></ui-card></body></html>"
    )
}

#[test]
fn page_styles_matching_component_or_supplied_slot_belong_to_the_page() {
    for selector in [".card-title", ".mine"] {
        let fixture = Fixture::new(&[
            ("specs/card.component.html", CARD),
            ("specs/page.page.html", &page(selector, "red", "")),
            (
                "specs/other.screen.html",
                "---\ntitle: Other\n---\n<ui-card></ui-card>",
            ),
        ]);
        fixture.edit("specs/page.page.html", &page(selector, "blue", ""));
        let result = fixture.compare().unwrap();
        assert_eq!(result.snapshot.changed_entries, ["page"], "{selector}");
        assert!(!entry(&result, "card").included);
        assert!(result.review.affected.is_empty());
        let page = result
            .entries
            .iter()
            .find(|entry| entry.path == "page")
            .unwrap();
        assert_eq!(
            page.documents[0].evidence.rules[0].owner,
            EvidenceOwner::Entry
        );
    }
}

#[test]
fn a_screen_style_changes_its_use_case_without_changing_the_component() {
    let screen = "---\ntitle: Home\nuseCasePaths: [tour]\n---\n<style>.card-title{color:red}</style><ui-card></ui-card>";
    let fixture = Fixture::new(&[
        ("specs/card.component.html", CARD),
        ("specs/home.screen.html", screen),
        (
            "specs/tour.use-case.yaml",
            "title: Tour\nsteps: [{screenPath: home}]\n",
        ),
    ]);
    fixture.edit("specs/home.screen.html", &screen.replace("red", "blue"));
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["home", "tour"]);
    assert!(!entry(&result, "card").included);
    assert!(result.review.affected.is_empty());
    assert!(
        entry(&result, "tour")
            .reasons
            .contains(&EntryChangeReason::Screen {
                screen_path: "home".into()
            })
    );
    assert!(
        entry(&result, "home")
            .views
            .iter()
            .all(|view| view.rules.is_empty())
    );
}

#[test]
fn owned_head_styles_are_not_collected_as_ownerless_rules() {
    let fixture = Fixture::new(&[
        ("specs/card.component.html", CARD),
        (
            "specs/page.page.html",
            &page(".card-title", "red", "data-mokly-owners=\"card\""),
        ),
    ]);
    fixture.edit(
        "specs/page.page.html",
        &page(".card-title", "blue", "data-mokly-owners=\"card\""),
    );
    let result = fixture.compare().unwrap();
    assert!(
        result
            .entries
            .iter()
            .flat_map(|entry| &entry.documents)
            .all(|view| view.evidence.rules.is_empty())
    );
    assert!(result.review.affected.is_empty());
}
