//! Current details follow their own index record's ready and included membership.

use crate::axes::EntryKind;
use crate::public_detail::{DetailEntry, DetailView, EntryDetailV1};
use crate::public_index::CatalogueReadModel;
use crate::public_metadata::{CatalogueChanges, ChangeKind, ComparisonSelection};
use crate::read_contract::ContractViolation;
use crate::readers::{self, ReadError};
use crate::usage::CatalogueUsage;

use super::validate;

fn fixture(kind: EntryKind, changes: CatalogueChanges) -> (CatalogueReadModel, EntryDetailV1) {
    let mut index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v7.json"
    ))
    .unwrap();
    let identity = index.identity.clone();
    let deployment_id = index.deployment_id.clone();
    let revision = index.revision;
    let (entry, visual) = match kind {
        EntryKind::Screen => {
            let record = &mut index.screens[0];
            (&mut record.entry, Some(&mut record.visual))
        }
        EntryKind::Component => {
            let record = &mut index.components[0];
            (&mut record.entry, Some(&mut record.visual))
        }
        EntryKind::Page => (&mut index.pages[0].entry, None),
        EntryKind::Document => (&mut index.documents[0].entry, None),
        EntryKind::UseCase => (&mut index.use_cases[0].entry, None),
    };
    entry.changes = changes;
    let path = entry.path.clone();
    let views = visual.map_or_else(Vec::new, |visual| {
        visual
            .views
            .iter_mut()
            .map(|view| {
                view.comparison = ComparisonSelection::Unavailable;
                DetailView {
                    viewport: view.viewport,
                    color_scheme: view.color_scheme,
                    usage: CatalogueUsage::Pending,
                    resource_evidence: None,
                }
            })
            .collect()
    });
    let detail = EntryDetailV1 {
        schema_version: 1,
        identity,
        deployment_id: Some(deployment_id),
        revision: Some(revision),
        generation: None,
        entry: DetailEntry {
            path,
            kind,
            snapshot_id: None,
        },
        reasons: None,
        views,
        resource_evidence: None,
        workspace: None,
    };
    (index, detail)
}

#[test]
fn every_entry_kind_requires_reasons_exactly_for_ready_included_membership() {
    for kind in [
        EntryKind::Screen,
        EntryKind::Component,
        EntryKind::Page,
        EntryKind::Document,
        EntryKind::UseCase,
    ] {
        for changes in [
            CatalogueChanges::Ready {
                kind: ChangeKind::Changed,
                included: true,
            },
            CatalogueChanges::Ready {
                kind: ChangeKind::Unmodified,
                included: true,
            },
            CatalogueChanges::Ready {
                kind: ChangeKind::Unmodified,
                included: false,
            },
            CatalogueChanges::Preparing,
            CatalogueChanges::Pending,
            CatalogueChanges::Unavailable,
            CatalogueChanges::Disabled,
        ] {
            let included = matches!(changes, CatalogueChanges::Ready { included: true, .. });
            let (index, mut detail) = fixture(kind, changes);
            for present in [false, true] {
                detail.reasons = present.then(Vec::new);
                let result = validate(&detail, &index);
                if present == included {
                    result.unwrap();
                } else {
                    assert!(
                        matches!(
                            result,
                            Err(ReadError::Contract {
                                message: ContractViolation::DetailReasonsPresence,
                                ..
                            })
                        ),
                        "{kind:?}, included {included}, present {present}: {result:?}"
                    );
                }
            }
        }
    }
}
