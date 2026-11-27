//! The built CLI preserves physical and supplier CSS ownership through Git comparison.

mod changes_support;
#[path = "../../../tests/rust/containment_assertions.rs"]
mod containment_assertions;
#[path = "../../../tests/rust/containment_fixture.rs"]
mod containment_fixture;
mod containment_support;

#[test]
fn component_nested_stack_rule_matches_the_flat_rule() {
    let case = containment_fixture::CASES[3];
    let review =
        containment_support::build(nested_sources(case, false), nested_sources(case, true));
    containment_assertions::check(&review, case);
}

#[test]
fn linked_stylesheet_nested_stack_rule_has_flat_evidence() {
    let source = |spacing| {
        vec![
            (
                "home.screen.html".into(),
                "---\ntitle: Home\n---\n<div class='stack'><i>A</i><i>B</i></div>".into(),
            ),
            (
                "styles.css".into(),
                format!(".stack {{ & > * + * {{ margin-top: {spacing}px }} }}"),
            ),
        ]
    };
    let config = r#"{"review":{"base":"fixture-base"},"stylesheets":[{"match":"**","stylesheets":["specs/styles.css"]}]}"#;
    let review = containment_support::build_configured(source(8), source(16), config);
    let home = review
        .entries
        .iter()
        .find(|entry| entry.path == "home")
        .unwrap();
    assert!(home.included);
    for view in &home.views {
        assert_eq!(view.state, mokly_model::review::ReviewState::Changed);
        assert_eq!(view.rules.len(), 1);
        assert_eq!(
            view.rules[0].status,
            mokly_model::evidence::RuleStatus::Matched
        );
        assert_eq!(
            view.rules[0].owner,
            mokly_model::evidence::EvidenceOwner::Entry
        );
    }
}

#[test]
fn head_nested_stack_rule_matches_the_flat_rule() {
    let case = containment_fixture::CASES[5];
    let review =
        containment_support::build(nested_sources(case, false), nested_sources(case, true));
    let changed = review
        .entries
        .iter()
        .filter(|entry| entry.included)
        .map(|entry| entry.path.as_str())
        .collect::<Vec<_>>();
    assert_eq!(changed, ["stack"]);
    assert_eq!(
        review
            .affected
            .iter()
            .map(|row| (
                row.changed_component_id.as_str(),
                row.consumer.path.as_str()
            ))
            .collect::<Vec<_>>(),
        [("stack", "page")]
    );
    let page = review
        .entries
        .iter()
        .find(|entry| entry.path == "page")
        .unwrap();
    for view in &page.views {
        assert_eq!(view.rules.len(), 1);
        assert_eq!(
            view.rules[0].owner,
            mokly_model::evidence::EvidenceOwner::Component {
                path: "stack".into()
            }
        );
        assert_eq!(
            view.rules[0].status,
            mokly_model::evidence::RuleStatus::Matched
        );
    }
}

fn nested_sources(case: containment_fixture::Case, changed: bool) -> Vec<(String, String)> {
    let mut files = containment_fixture::sources(case, changed);
    let spacing = if changed
        && matches!(
            case.edit,
            containment_fixture::Edit::Stack | containment_fixture::Edit::Both
        ) {
        16
    } else {
        8
    };
    let flat = format!("'.stack > * + *{{margin-top:{spacing}px}}'");
    let nested = format!("'.stack {{ & > * + * {{ margin-top:{spacing}px }} }}'");
    let rules = files
        .iter_mut()
        .find(|(path, _)| path == "rules.ts")
        .unwrap();
    rules.1 = rules.1.replace(&flat, &nested);
    files
}
