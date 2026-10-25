//! Functional arguments cannot enable scoped universal ownership proof.

use mokly_model::evidence::{EvidenceOwner, RuleStatus};
use mokly_model::review::ReviewState;

mod changes_support;
#[expect(dead_code, reason = "this case uses the configured build entry point")]
mod containment_support;

#[test]
fn an_argument_local_anchor_keeps_universal_rules_unresolved() {
    for selector in [
        ":has(.missing > *)",
        ":is(.missing > *)",
        ":not(.missing > *)",
    ] {
        let sources = |margin| {
            vec![
                (
                    "home.screen.html".into(),
                    "---\ntitle: Home\n---\n<p>No matching descendant</p>".into(),
                ),
                (
                    "styles.css".into(),
                    format!("{selector}{{margin-left:{margin}px}}"),
                ),
            ]
        };
        let config = r#"{"review":{"base":"fixture-base"},"stylesheets":[{"match":"**","stylesheets":["specs/styles.css"]}]}"#;
        let review = containment_support::build_configured(sources(1), sources(2), config);
        let home = &review.entries[0];
        assert!(home.included, "{selector}");
        for view in &home.views {
            assert_eq!(view.state, ReviewState::Changed, "{selector}");
            assert_eq!(view.rules.len(), 1);
            assert_eq!(view.rules[0].status, RuleStatus::Unresolved, "{selector}");
            assert_eq!(view.rules[0].owner, EvidenceOwner::Entry);
        }
    }
}
