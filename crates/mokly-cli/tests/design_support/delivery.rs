//! Configured, declared, CSS-imported and JavaScript-imported rules use own-page proof.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_css::rule_collection;
use mokly_css::rules::ParsedCss;
use mokly_model::evidence::{EvidenceOwner, RuleEvidence, RuleStatus};
use mokly_model::review_order;
use mokly_model::usage::CatalogueUsage;

use crate::changes_support::write;

use super::native::Session;
use super::{edit, matrix, text};

const TOP: &str = "design/library/chrome/top-bar";
const DECLARED: &str = "examples/basic/design-library/chrome/top-bar.css";
const MODULE: &str = "examples/basic/specs/design/library/chrome/top-bar.tsx";
const IMPORTED: &str = "examples/basic/design-library/chrome/m9-imported.css";
const JS_CSS: &str = "examples/basic/m9-imported.css";
const CASES: [(&str, &str, &str); 4] = [
    (
        "configured",
        "examples/basic/design-components.css",
        ".mbk-topbar.mbk-topbar",
    ),
    ("declared", DECLARED, ".mbk-topbar.mbk-topbar.mbk-topbar"),
    (
        "css-imported",
        IMPORTED,
        ".mbk-topbar.mbk-topbar.mbk-topbar.mbk-topbar",
    ),
    (
        "javascript-imported",
        JS_CSS,
        ".mbk-topbar.mbk-topbar.mbk-topbar.mbk-topbar.mbk-topbar",
    ),
];

pub fn seed(root: &Path) {
    write(
        root,
        DECLARED,
        &format!("@import './m9-imported.css';\n{}", text(root, DECLARED)),
    );
    write(
        root,
        MODULE,
        &format!(
            "import '../../../../m9-imported.css';\n{}",
            text(root, MODULE)
        ),
    );
    write(root, IMPORTED, "");
    write(root, JS_CSS, "");
    for (_, path, selector) in CASES {
        write(
            root,
            path,
            &format!(
                "{}\n{selector} {{ outline-color: red; }}\n",
                text(root, path)
            ),
        );
    }
}

pub fn run(root: &Path, session: &Session) {
    let own: Vec<_> = [
        "",
        "/auto-appearance",
        "/default",
        "/drawer-open",
        "/search",
        "/tag-picker",
    ]
    .iter()
    .map(|suffix| format!("{TOP}{suffix}"))
    .collect();
    let edits: Vec<_> = CASES
        .iter()
        .map(|(_, path, selector)| {
            let before = format!("{selector} {{ outline-color: red; }}");
            let after = format!("{selector} {{ outline-color: blue; }}");
            let source = text(root, path);
            assert_eq!(source.matches(&before).count(), 1);
            (*path, source.replace(&before, &after))
        })
        .collect();
    edit(
        root,
        session,
        "four CSS delivery rules",
        &edits,
        &|result| {
            matrix::changed(result, &own);
            check(result);
            matrix::affected(result, "top_bar_shared_rules");
        },
    );
}

fn check(result: &ComparisonResult) {
    let mut delivered: BTreeMap<&str, BTreeSet<String>> = BTreeMap::new();
    for side in [&result.before, &result.after] {
        for route in side
            .resource_routes()
            .into_iter()
            .filter(|route| route.ends_with(".css"))
        {
            let bytes = side.resource(&route).unwrap().unwrap();
            let ParsedCss::Rules(rules) = rule_collection::collect(&bytes) else {
                panic!("invalid delivered CSS: {route}");
            };
            for (name, _, selector) in CASES {
                if rules
                    .iter()
                    .any(|rule| rule.selectors.iter().any(|actual| actual == selector))
                {
                    delivered
                        .entry(name)
                        .or_default()
                        .insert(format!("static/mokly-generated/{route}"));
                }
            }
        }
    }
    for (name, _, _) in CASES {
        assert!(!delivered.get(name).unwrap().is_empty(), "{name}");
    }
    for entry in &result.entries {
        for view in &entry.documents {
            let route = view.after_route.as_ref().unwrap();
            let artifact = result.after.render(route).unwrap();
            let document = artifact.document.as_ref().unwrap();
            let matched = entry.path == TOP
                || entry.path.starts_with(&format!("{TOP}/"))
                || matches!(&document.usage, CatalogueUsage::Ready { instances, .. } if instances.iter().any(|instance| instance.component_id == TOP));
            let linked: BTreeSet<_> = [&result.before, &result.after]
                .into_iter()
                .flat_map(|side| {
                    side.closure(route)
                        .unwrap()
                        .evidence
                        .into_iter()
                        .map(|resource| resource.path)
                })
                .collect();
            let mut expected = Vec::new();
            for (name, _, selector) in CASES {
                let mut per_rule = Vec::new();
                for stylesheet in delivered[name].intersection(&linked) {
                    per_rule.push(RuleEvidence {
                        stylesheet: stylesheet.clone(),
                        selector: if matched {
                            selector.into()
                        } else {
                            String::new()
                        },
                        status: if matched {
                            RuleStatus::Matched
                        } else {
                            RuleStatus::Excluded
                        },
                        owner: if matched {
                            EvidenceOwner::Component { path: TOP.into() }
                        } else {
                            EvidenceOwner::Entry
                        },
                    });
                }
                let actual: Vec<_> = view
                    .evidence
                    .rules
                    .iter()
                    .filter(|rule| {
                        delivered[name].contains(&rule.stylesheet)
                            && (rule.selector == selector || rule.status == RuleStatus::Excluded)
                    })
                    .cloned()
                    .collect();
                per_rule.sort_by_key(review_order::rule_key);
                assert_eq!(actual, per_rule, "{name} {route}");
                expected.extend(per_rule);
            }
            expected.sort_by_key(review_order::rule_key);
            expected.dedup();
            assert_eq!(view.evidence.rules, expected, "{route}");
            assert!(view.evidence.resources.is_empty(), "{route}");
        }
    }
}
