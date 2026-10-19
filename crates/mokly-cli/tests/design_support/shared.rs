//! All nine sheets use exact per-view evidence and an exact changed-entry union.

use std::path::Path;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::evidence::{EvidenceOwner, RuleEvidence, RuleStatus};
use mokly_model::review::EntryChangeReason;
use mokly_model::review_order;
use mokly_model::usage::CatalogueUsage;

use super::native::Session;
use super::scopes::{self, SHEETS, Scopes};
use super::{edit, matrix, text};

const TOP: &str = "design/library/chrome/top-bar";

pub fn run(root: &Path, session: &Session, scopes: &Scopes) {
    let paths: Vec<_> = SHEETS
        .iter()
        .map(|sheet| format!("examples/basic/{sheet}"))
        .collect();
    let edits: Vec<_> = paths.iter().map(|path| {
        (path.as_str(), format!(
            "{}\n.m9-absent {{ outline-color: rgb(1, 2, 3); }}\nbody {{ outline-color: rgb(4, 5, 6); }}\n.mbk-topbar {{ outline-color: rgb(7, 8, 9); }}\n",
            text(root, path)
        ))
    }).collect();
    edit(
        root,
        session,
        "nine shared sheets with three rule statuses",
        &edits,
        &|result| check(result, scopes),
    );
    let path = "examples/basic/design.css";
    edit(
        root,
        session,
        "global tokens stay page evidence",
        &[(
            path,
            format!("{}\n:root {{ --m9-token: 1; }}\n", text(root, path)),
        )],
        &|result| {
            let expected: Vec<_> = scopes
                .iter()
                .filter(|(_, sheets)| !sheets.is_empty())
                .map(|(path, _)| path.clone())
                .collect();
            matrix::changed(result, &expected);
            assert!(result.review.affected.is_empty());
            for entry in &result.entries {
                let rules = if !scopes[&entry.path].is_empty() {
                    vec![RuleEvidence {
                        stylesheet: scopes::route("design.css"),
                        selector: ":root".into(),
                        status: RuleStatus::Unresolved,
                        owner: EvidenceOwner::Entry,
                    }]
                } else {
                    vec![]
                };
                for view in &entry.documents {
                    assert_eq!(view.evidence.rules, rules, "{}", entry.path);
                    assert!(view.evidence.resources.is_empty(), "{}", entry.path);
                }
                if entry.included {
                    assert_eq!(
                        entry.reasons,
                        vec![EntryChangeReason::Dependency {
                            path: scopes::route("design.css")
                        }]
                    );
                }
            }
        },
    );
}

fn check(result: &ComparisonResult, scopes: &Scopes) {
    let expected: Vec<_> = scopes
        .iter()
        .filter(|(_, sheets)| !sheets.is_empty())
        .map(|(path, _)| path.clone())
        .collect();
    matrix::changed(result, &expected);
    matrix::affected(result, "top_bar_shared_rules");
    assert!(
        result
            .review
            .affected
            .iter()
            .all(|record| record.changed_component_id == TOP),
        "unresolved rules add no affected components"
    );
    for entry in &result.entries {
        let mut reasons: Vec<_> = if entry.included {
            scopes[&entry.path]
                .iter()
                .map(|sheet| scopes::route(sheet))
                .collect()
        } else {
            vec![]
        };
        reasons.sort();
        let mut actual: Vec<_> = entry
            .reasons
            .iter()
            .map(|reason| match reason {
                EntryChangeReason::Dependency { path } => path.clone(),
                other => panic!("unexpected reason for {}: {other:?}", entry.path),
            })
            .collect();
        actual.sort();
        assert_eq!(actual, reasons, "{}", entry.path);
        for view in &entry.documents {
            let route = view.after_route.as_ref().unwrap();
            let artifact = result.after.render(route).unwrap();
            let usage = &artifact.document.as_ref().unwrap().usage;
            let top = entry.path == TOP
                || entry.path.starts_with(&format!("{TOP}/"))
                || matches!(usage, CatalogueUsage::Ready { instances, .. } if instances.iter().any(|instance| instance.component_id == TOP));
            let mut rules = Vec::new();
            for sheet in &scopes[&entry.path] {
                let stylesheet = scopes::route(sheet);
                for (selector, status, owner) in [
                    (".m9-absent", RuleStatus::Excluded, EvidenceOwner::Entry),
                    ("body", RuleStatus::Unresolved, EvidenceOwner::Entry),
                    (
                        ".mbk-topbar",
                        RuleStatus::Matched,
                        EvidenceOwner::Component { path: TOP.into() },
                    ),
                ] {
                    let expected = if status == RuleStatus::Excluded
                        || (status == RuleStatus::Matched && !top)
                    {
                        vec![]
                    } else {
                        vec![RuleEvidence {
                            stylesheet: stylesheet.clone(),
                            selector: selector.into(),
                            status,
                            owner,
                        }]
                    };
                    let actual: Vec<_> = view
                        .evidence
                        .rules
                        .iter()
                        .filter(|rule| rule.stylesheet == stylesheet && rule.selector == selector)
                        .cloned()
                        .collect();
                    assert_eq!(
                        actual, expected,
                        "{} {route} {sheet} {selector}",
                        entry.path
                    );
                    rules.extend(expected);
                }
            }
            rules.sort_by_key(review_order::rule_key);
            assert_eq!(view.evidence.rules, rules, "{} {route}", entry.path);
            assert!(view.evidence.resources.is_empty(), "{} {route}", entry.path);
        }
    }
}
