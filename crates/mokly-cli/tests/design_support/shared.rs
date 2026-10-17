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
    for (label, selector, status) in [
        (
            "nine excluded shared sheets",
            ".m9-absent",
            RuleStatus::Excluded,
        ),
        (
            "nine unresolved shared sheets",
            "body",
            RuleStatus::Unresolved,
        ),
        (
            "nine component matched shared sheets",
            ".mbk-topbar",
            RuleStatus::Matched,
        ),
    ] {
        let paths: Vec<_> = SHEETS
            .iter()
            .map(|sheet| format!("examples/basic/{sheet}"))
            .collect();
        let edits: Vec<_> = paths
            .iter()
            .map(|path| {
                (
                    path.as_str(),
                    format!(
                        "{}\n{selector} {{ outline-color: rgb(1, 2, 3); }}\n",
                        text(root, path)
                    ),
                )
            })
            .collect();
        edit(root, session, label, &edits, &|result| {
            check(result, scopes, selector, &status)
        });
    }
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

fn check(result: &ComparisonResult, scopes: &Scopes, selector: &str, status: &RuleStatus) {
    let expected = match status {
        RuleStatus::Excluded => vec![],
        RuleStatus::Unresolved => scopes
            .iter()
            .filter(|(_, sheets)| !sheets.is_empty())
            .map(|(path, _)| path.clone())
            .collect(),
        RuleStatus::Matched => scopes
            .keys()
            .filter(|path| *path == TOP || path.starts_with(&format!("{TOP}/")))
            .cloned()
            .collect(),
    };
    matrix::changed(result, &expected);
    if *status != RuleStatus::Matched {
        assert!(result.review.affected.is_empty());
    }
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
            let matched = *status == RuleStatus::Matched && top;
            let excluded =
                *status == RuleStatus::Excluded || (*status == RuleStatus::Matched && !top);
            let mut rules: Vec<_> = scopes[&entry.path]
                .iter()
                .map(|sheet| RuleEvidence {
                    stylesheet: scopes::route(sheet),
                    selector: if excluded {
                        String::new()
                    } else {
                        selector.into()
                    },
                    status: if excluded {
                        RuleStatus::Excluded
                    } else {
                        status.clone()
                    },
                    owner: if matched {
                        EvidenceOwner::Component { path: TOP.into() }
                    } else {
                        EvidenceOwner::Entry
                    },
                })
                .collect();
            rules.sort_by_key(review_order::rule_key);
            assert_eq!(view.evidence.rules, rules, "{} {route}", entry.path);
            assert!(view.evidence.resources.is_empty(), "{} {route}", entry.path);
        }
    }
    if *status == RuleStatus::Matched {
        matrix::affected(result, "top_bar_shared_rules");
    }
}
