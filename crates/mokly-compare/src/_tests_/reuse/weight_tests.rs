//! Both observation collections charge detached ancestry and every owned heap buffer.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_css::attribution::{self, PageObservation};
use mokly_css::containment::ContainmentPath;
use mokly_css::match_tree::{Containment, MatchElement, MatchTree};
use mokly_css::rule_collection::collect;
use mokly_css::rule_matching::match_document;
use mokly_css::rules::diff;
use mokly_model::axes::ColorScheme;
use mokly_model::evidence::{EvidenceOwner, ViewEvidence};
use mokly_model::review::ReviewState;

use crate::comparison_types::{DocumentComparison, ViewKey};
use crate::comparison_views::{ImmutableView, PendingView};
use crate::owned_styles::Changes;
use crate::reuse_budget::Resident;
use crate::reuse_collection::Collection;
use crate::reuse_reads::Recorder;

#[test]
fn owned_and_page_rule_heap_or_ancestry_overflow_discards_the_complete_candidate() {
    assert_eq!(retain(false, false, false), (true, false));
    for owned in [false, true] {
        for ancestry in [false, true] {
            assert_eq!(
                retain(owned, ancestry, true),
                (false, true),
                "owned={owned}, ancestry={ancestry}"
            );
        }
    }
}

fn retain(owned: bool, ancestry: bool, large: bool) -> (bool, bool) {
    let tree = MatchTree {
        elements: vec![MatchElement {
            name: "p".into(),
            namespace: "http://www.w3.org/1999/xhtml".into(),
            attributes: BTreeMap::from([("class".into(), "hit".into())]),
            parent: None,
            children: vec![],
            text: false,
            regions: ContainmentPath::default().with_region(Containment {
                path: if large && ancestry {
                    "x".repeat(65536)
                } else {
                    "owner".into()
                },
                root: true,
                instance: None,
            }),
            input_regions: ContainmentPath::default(),
            owner: EvidenceOwner::Entry,
        }],
    };
    let matching = match_document(
        &diff(&collect(b""), &collect(b".hit{color:red}")),
        None,
        Some(&tree),
    );
    let mut rules =
        attribution::observe_owned("sheet.css", &matching, None, Some(&tree), Some("owner"));
    if large && !ancestry {
        rules[0].stylesheet = "s".repeat(65536);
    }
    let mut changes = Changes::default();
    let observation = if owned {
        changes.rules = rules;
        PageObservation::default()
    } else {
        PageObservation {
            component: None,
            rules,
        }
    };
    let view = PendingView::new(Arc::new(ImmutableView {
        document: DocumentComparison {
            key: ViewKey {
                viewport: None,
                color_scheme: ColorScheme::Light,
            },
            before_route: None,
            after_route: None,
            state: ReviewState::Changed,
            ignored_ids: vec![],
            evidence: ViewEvidence {
                rules: vec![],
                resources: vec![],
            },
        },
        observation,
        material: false,
        inputs: false,
        structure: false,
        root_changed: false,
        proofs: vec![],
        owned: changes,
    }));
    let resident = Resident::new(16384);
    let mut collection = Collection::new(resident, None, Some([0; 32]));
    let recorder = Recorder::new(&collection.probes).unwrap();
    collection.compared(Some([1; 32]), &view, &[], Some(recorder));
    (collection.candidate.is_some(), collection.work.overflowed)
}
