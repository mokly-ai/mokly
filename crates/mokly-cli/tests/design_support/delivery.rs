//! Configured, declared, CSS-imported and JavaScript-imported rules use own-page proof.

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::evidence::{EvidenceOwner, RuleEvidence, RuleStatus};
use mokly_model::review_order;
use mokly_model::usage::CatalogueUsage;

use crate::changes_support::{git, write};

use super::native::Session;
use super::{commit, edit, matrix, text};

const TOP: &str = "design/library/chrome/top-bar";
const DECLARED: &str = "examples/basic/design-library/chrome/top-bar.css";
const MODULE: &str = "examples/basic/specs/design/library/chrome/top-bar.tsx";
const IMPORTED: &str = "examples/basic/design-library/chrome/m9-imported.css";
const JS_CSS: &str = "examples/basic/m9-imported.css";
const SELECTOR: &str = ".mbk-topbar.mbk-topbar";
const RULE: &str = ".mbk-topbar.mbk-topbar { outline-color: red; }";

pub fn run(root: &Path, delivery: &str) {
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
    let declared = text(root, DECLARED);
    let module = text(root, MODULE);
    let configured_path = "examples/basic/design-components.css";
    let configured = text(root, configured_path);
    {
        let path = match delivery {
            "configured" => configured_path,
            "declared" => DECLARED,
            "css-imported" => {
                write(
                    root,
                    DECLARED,
                    &format!("@import './m9-imported.css';\n{declared}"),
                );
                IMPORTED
            }
            _ => {
                write(
                    root,
                    MODULE,
                    &format!("import '../../../../m9-imported.css';\n{module}"),
                );
                JS_CSS
            }
        };
        let original = fs::read_to_string(root.join(path)).unwrap_or_default();
        let before = format!("{original}\n{RULE}\n");
        write(root, path, &before);
        commit(root, &format!("registered {delivery} base"));
        git(root, &["branch", "--force", "fixture-base", "HEAD"]);
        {
            let session = Session::new(root);
            edit(
                root,
                &session,
                delivery,
                &[(
                    path,
                    before.replace("outline-color: red", "outline-color: blue"),
                )],
                &|result| {
                    matrix::changed(result, &own);
                    check(result);
                    matrix::affected(result, "top_bar_shared_rules");
                },
            );
        }
        write(root, DECLARED, &declared);
        write(root, MODULE, &module);
        write(root, configured_path, &configured);
        for path in [IMPORTED, JS_CSS] {
            if root.join(path).exists() {
                fs::remove_file(root.join(path)).unwrap();
            }
        }
    }
}

fn check(result: &ComparisonResult) {
    let mut delivered = BTreeSet::new();
    for side in [&result.before, &result.after] {
        for route in side
            .resource_routes()
            .into_iter()
            .filter(|route| route.ends_with(".css"))
        {
            let bytes = side.resource(&route).unwrap().unwrap();
            if String::from_utf8_lossy(&bytes).contains(SELECTOR) {
                delivered.insert(format!("static/mokly-generated/{route}"));
            }
        }
    }
    assert!(!delivered.is_empty());
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
                .filter(|path| delivered.contains(path))
                .collect();
            let mut expected: Vec<_> = linked
                .into_iter()
                .map(|stylesheet| RuleEvidence {
                    stylesheet,
                    selector: if matched {
                        SELECTOR.into()
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
                })
                .collect();
            expected.sort_by_key(review_order::rule_key);
            assert_eq!(view.evidence.rules, expected, "{route}");
            assert!(view.evidence.resources.is_empty(), "{route}");
        }
    }
}
