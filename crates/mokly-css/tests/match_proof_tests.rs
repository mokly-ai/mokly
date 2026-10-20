//! Public match proof exposes only the containment permitted by input ownership.

use std::collections::BTreeMap;

use mokly_css::attribution;
use mokly_css::inline_attribution;
use mokly_css::match_tree::{Containment, MatchElement, MatchTree};
use mokly_css::rule_collection::collect;
use mokly_css::rule_matching::match_document;
use mokly_css::rules::diff;
use mokly_model::evidence::EvidenceOwner;

#[test]
fn detached_inline_proof_exposes_its_supplier_without_the_receiving_component() {
    for (owner, expected) in [
        (EvidenceOwner::Entry, Vec::new()),
        (
            EvidenceOwner::Component {
                path: "supplier".into(),
            },
            vec!["supplier"],
        ),
        (
            EvidenceOwner::Component {
                path: "receiver".into(),
            },
            vec!["receiver"],
        ),
    ] {
        let (linked, inline) = {
            let tree = MatchTree {
                elements: vec![MatchElement {
                    name: "p".into(),
                    namespace: "http://www.w3.org/1999/xhtml".into(),
                    attributes: BTreeMap::from([("class".into(), "hit".into())]),
                    parent: None,
                    children: Vec::new(),
                    text: false,
                    regions: [
                        Containment {
                            path: "supplier".into(),
                            root: true,
                        },
                        Containment {
                            path: "receiver".into(),
                            root: false,
                        },
                    ]
                    .into_iter()
                    .collect(),
                    input_regions: expected
                        .iter()
                        .rev()
                        .map(|path| Containment {
                            path: (*path).into(),
                            root: *path == "supplier",
                        })
                        .collect(),
                    owner,
                }],
            };
            let matching = match_document(
                &diff(&collect(b".hit{color:red}"), &collect(b".hit{color:blue}")),
                Some(&tree),
                Some(&tree),
            );
            (
                attribution::observe("sheet.css", &matching, Some(&tree), Some(&tree)),
                inline_attribution::observe("page.html", &matching, Some(&tree), Some(&tree)),
            )
        };
        for (rules, expected) in [(linked, vec!["receiver", "supplier"]), (inline, expected)] {
            let matches = &rules[0].selectors[0].matches;
            assert_eq!(matches.len(), 2);
            for proof in matches {
                assert_eq!(
                    proof
                        .regions()
                        .map(|region| region.path.as_str())
                        .collect::<Vec<_>>(),
                    expected,
                );
            }
        }
    }
}
