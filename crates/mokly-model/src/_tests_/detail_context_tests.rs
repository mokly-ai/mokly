//! A current detail is valid only within one exact index fence and view set.

use crate::axes::EntryKind;
use crate::public_detail::{DetailEntry, DetailView, EntryDetailV2};
use crate::read_contract::ContractViolation;
use crate::readers;
use crate::readers::ReadError;
use crate::review::ReviewEntryAddress;
use crate::usage::CatalogueUsage;

use super::validate;

#[test]
fn control_order_names_every_editable_prop_once() {
    let index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v8.json"
    ))
    .unwrap();
    let fixtures: serde_json::Value = serde_json::from_str(include_str!(
        "../../../../docs/protocol/fixtures/entry-details-v2.json"
    ))
    .unwrap();
    let mut detail =
        readers::detail(&fixtures["current"]["components/action"].to_string()).unwrap();
    validate(&detail, &index).unwrap();
    for order in [
        None,
        Some(vec![]),
        Some(vec!["missing".into()]),
        Some(vec!["label".into(), "label".into()]),
    ] {
        detail.control_order = order;
        assert!(matches!(
            validate(&detail, &index),
            Err(ReadError::Contract {
                message: ContractViolation::ControlOrder,
                ..
            })
        ));
    }
}

#[test]
fn identity_deployment_revision_kind_and_view_order_are_fenced() {
    let mut index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v8.json"
    ))
    .unwrap();
    for entry in &mut index.screens {
        for view in &mut entry.visual.views {
            view.comparison = crate::public_metadata::ComparisonSelection::Unavailable;
        }
    }
    let screen = &index.screens[0];
    let detail = EntryDetailV2 {
        schema_version: 2,
        control_order: Some(screen.visual.controls.keys().cloned().collect()),
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
                state: None,
                ignored_ids: None,
                resource_evidence: None,
            })
            .collect(),
        workspace: None,
        reasons: Some(vec![]),
        before: Some(ReviewEntryAddress {
            path: screen.entry.path.clone(),
            title: screen.entry.title.clone(),
            props: None,
            supplied_slots: None,
        }),
        resource_evidence: None,
    };
    validate(&detail, &index).unwrap();
    for mutation in 0..7 {
        let mut candidate = detail.clone();
        match mutation {
            0 => candidate.identity.id = "0".repeat(64),
            1 => candidate.deployment_id = Some("f".repeat(64)),
            2 => candidate.revision = Some(index.revision + 1),
            3 => candidate.entry.kind = EntryKind::Component,
            4 => {
                candidate.views.pop();
            }
            5 => candidate.before = None,
            _ => candidate.views.reverse(),
        }
        assert!(validate(&candidate, &index).is_err(), "mutation {mutation}");
    }
}
