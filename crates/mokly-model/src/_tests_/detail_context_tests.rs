//! A current detail is valid only within one exact index fence and view set.

use crate::axes::EntryKind;
use crate::public_detail::{DetailEntry, DetailView, EntryDetailV1};
use crate::readers;
use crate::usage::CatalogueUsage;

use super::validate;

#[test]
fn identity_deployment_revision_kind_and_view_order_are_fenced() {
    let mut index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v7.json"
    ))
    .unwrap();
    for entry in &mut index.screens {
        for view in &mut entry.visual.views {
            view.comparison = crate::public_metadata::ComparisonSelection::Unavailable;
        }
    }
    let screen = &index.screens[0];
    let detail = EntryDetailV1 {
        schema_version: 1,
        identity: index.identity.clone(),
        deployment_id: Some(index.deployment_id.clone()),
        revision: Some(index.revision),
        generation: None,
        entry: DetailEntry {
            path: screen.entry.path.clone(),
            kind: EntryKind::Screen,
            snapshot_id: None,
        },
        views: screen
            .visual
            .views
            .iter()
            .map(|view| DetailView {
                viewport: view.viewport,
                color_scheme: view.color_scheme,
                usage: CatalogueUsage::Pending,
                resource_evidence: None,
            })
            .collect(),
        workspace: None,
        reasons: Some(vec![]),
        resource_evidence: None,
    };
    validate(&detail, &index).unwrap();
    for mutation in 0..6 {
        let mut candidate = detail.clone();
        match mutation {
            0 => candidate.identity.id = "0".repeat(64),
            1 => candidate.deployment_id = Some("f".repeat(64)),
            2 => candidate.revision = Some(index.revision + 1),
            3 => candidate.entry.kind = EntryKind::Component,
            4 => {
                candidate.views.pop();
            }
            _ => candidate.views.reverse(),
        }
        assert!(validate(&candidate, &index).is_err(), "mutation {mutation}");
    }
}
