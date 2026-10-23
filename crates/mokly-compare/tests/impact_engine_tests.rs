//! Accepted implementation-impact contracts keep direct rows and own views exact.

use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::{EntryChangeReason, ReviewState};

#[expect(dead_code, reason = "these fixtures edit sources without moving them")]
mod engine_support;
use engine_support::{Fixture, entry};

#[test]
fn variant_only_css_resource_and_render_impact_keep_the_parent_out_of_changes() {
    for mode in ["css", "resource", "render"] {
        let fixture = Fixture::new(&[
            (
                "mokly.config.json",
                "{\"stylesheets\":[{\"match\":\"**\",\"stylesheets\":[\"style.css\"]}]}",
            ),
            ("style.css", ".special{color:red}"),
            ("circle.svg", "circle"),
            ("star.svg", "star"),
            (
                "specs/icon.component.html",
                "---\ntitle: Icon\nelement: ui-icon\npropSchema: {type: object, additionalProperties: false, required: [on, source], properties: {on: {type: boolean}, source: {type: string}}}\nprops: {on: false, source: ../../circle.svg}\nvariants: [{slug: on, title: On, props: {on: true, source: ../../../star.svg}}]\n---\n<img src=\"{{source}}\"><p mokly-if=\"$on\" class=\"special\">Before</p>",
            ),
            (
                "specs/home.screen.html",
                "---\ntitle: Home\n---\n<ui-icon on=\"false\" source=\"../../circle.svg\"></ui-icon>",
            ),
        ]);
        match mode {
            "css" => fixture.edit("style.css", ".special{color:blue}"),
            "resource" => fixture.edit("star.svg", "edited star"),
            _ => {
                let path = fixture.directory.path().join("specs/icon.component.html");
                fixture.edit(
                    "specs/icon.component.html",
                    &std::fs::read_to_string(path)
                        .unwrap()
                        .replace("Before", "After"),
                );
            }
        }
        let result = fixture.compare().unwrap();
        assert_eq!(result.snapshot.changed_entries, ["icon/on"], "{mode}");
        assert!(!entry(&result, "icon").included);
        assert_eq!(entry(&result, "icon").state, ReviewState::Unchanged);
        assert_eq!(result.review.affected[0].changed_component_id, "icon");
        assert_eq!(result.review.affected[0].consumer.path, "home");
    }
}

#[test]
fn actual_instance_render_proof_uses_implementation_without_changing_own_views() {
    let source = "---\ntitle: Toggle\nelement: ui-toggle\npropSchema: {type: object, additionalProperties: false, required: [on], properties: {on: {type: boolean}}}\nprops: {on: false}\n---\n<p mokly-if=\"$on\">Before</p>";
    let fixture = Fixture::new(&[
        ("specs/toggle.component.html", source),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<ui-toggle on=\"true\"></ui-toggle>",
        ),
    ]);
    fixture.edit(
        "specs/toggle.component.html",
        &source.replace("Before", "After"),
    );
    let result = fixture.compare().unwrap();
    let component = entry(&result, "toggle");
    assert_eq!(component.reasons, [EntryChangeReason::Implementation]);
    assert_eq!(component.state, ReviewState::Unchanged);
    assert!(
        component
            .views
            .iter()
            .all(|view| view.state == ReviewState::Unchanged)
    );
    assert_eq!(result.snapshot.changed_entries, ["toggle"]);
    assert_eq!(result.review.affected[0].consumer.path, "home");
}

#[test]
fn actual_instance_resource_proof_requires_the_exact_unchanged_inputs() {
    for input_edit in [false, true] {
        let source = if input_edit { "circle" } else { "other" };
        let home = |source| {
            format!("---\ntitle: Home\n---\n<ui-icon source=\"../../{source}.svg\"></ui-icon>")
        };
        let fixture = Fixture::new(&[
            (
                "specs/icon.component.html",
                "---\ntitle: Icon\nelement: ui-icon\npropSchema: {type: object, additionalProperties: false, required: [source], properties: {source: {type: string}}}\nprops: {source: ../../circle.svg}\n---\n<img src=\"{{source}}\">",
            ),
            ("specs/home.screen.html", &home(source)),
            ("circle.svg", "circle"),
            ("other.svg", "other"),
        ]);
        fixture.edit("other.svg", "changed");
        if input_edit {
            fixture.edit("specs/home.screen.html", &home("other"));
        }
        let result = fixture.compare().unwrap();
        assert_eq!(entry(&result, "icon").included, !input_edit);
        assert_eq!(entry(&result, "icon").state, ReviewState::Unchanged);
        if input_edit {
            assert!(result.review.affected.is_empty());
        } else {
            assert_eq!(
                entry(&result, "icon").reasons,
                [EntryChangeReason::Dependency {
                    path: "static/other.svg".into()
                }]
            );
            assert_eq!(result.review.affected[0].consumer.path, "home");
        }
    }
}

#[test]
fn a_selector_inside_two_changed_components_keeps_the_consumer_affected_only() {
    let fixture = Fixture::new(&[
        (
            "mokly.config.json",
            "{\"stylesheets\":[{\"match\":\"**\",\"stylesheets\":[\"style.css\"]}]}",
        ),
        ("style.css", ".shared{color:red}"),
        (
            "specs/x.component.html",
            "---\ntitle: X\nelement: ui-x\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<p class=\"shared\">X</p>",
        ),
        (
            "specs/y.component.html",
            "---\ntitle: Y\nelement: ui-y\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<p class=\"shared\">Y</p>",
        ),
        (
            "specs/both.screen.html",
            "---\ntitle: Both\n---\n<ui-x></ui-x><ui-y></ui-y>",
        ),
    ]);
    fixture.edit("style.css", ".shared{color:blue}");
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["x", "y"]);
    let rules = &entry(&result, "both").views[0].rules;
    assert_eq!(rules.len(), 2);
    assert!(rules.iter().all(|rule| rule.status == RuleStatus::Matched
        && matches!(rule.owner, EvidenceOwner::Component { .. })));
    assert_eq!(result.review.affected.len(), 2);
}

#[test]
fn head_styles_use_document_routes_and_distinguish_kept_excluded_and_formatting() {
    for (selector, after, included, records) in [
        (".x", ".x{color:blue}", true, 1),
        (".absent", ".absent{color:blue}", false, 1),
        (".x", ".x { color: red; }", false, 0),
    ] {
        let page = |style: &str| {
            format!(
                "---\ntitle: Reference\n---\n<!doctype html><html><head><title>Reference</title><style>{style}</style></head><body><p class=\"x\">Text</p></body></html>"
            )
        };
        let fixture = Fixture::new(&[(
            "specs/reference.page.html",
            &page(&format!("{selector}{{color:red}}")),
        )]);
        fixture.edit("specs/reference.page.html", &page(after));
        let result = fixture.compare().unwrap();
        let entry = &result.entries[0];
        assert_eq!(entry.included, included);
        let rules = &entry.documents[0].evidence.rules;
        assert_eq!(rules.len(), records);
        if records > 0 {
            assert_eq!(
                rules[0].stylesheet,
                "static/mokly-generated/reference/index.html"
            );
            assert_eq!(
                rules[0].status,
                if included {
                    RuleStatus::Matched
                } else {
                    RuleStatus::Excluded
                }
            );
        }
    }
}
