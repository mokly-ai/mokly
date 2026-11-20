//! Identity zeroes only public top-level fences and sorts by UTF-16 path order.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;
use mokly_model::canonical;
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry};
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::inventory::Inventory;
use mokly_model::output::validation::digest;
use mokly_model::projection::{self, Publication};
use mokly_model::public_detail::{DetailEntry, EntryDetailV4};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::readers;
use mokly_model::review::EntryChangeReason;
use serde_json::json;

use crate::identity::{finalize, json};

fn index() -> CatalogueReadModel {
    projection::index(
        &CatalogueModel {
            entries: vec![],
            folders: vec![],
            sources: vec![],
            color_schemes: vec![],
        },
        &[],
        &Publication {
            config_path: "mokly.config.json".into(),
            deployment_id: "e".repeat(64),
            revision: 0,
            base: None,
            changes_status: ChangesStatus::Disabled,
            live_generation: None,
        },
    )
}

fn page_index(paths: &[&str]) -> CatalogueReadModel {
    projection::index(
        &CatalogueModel {
            entries: paths
                .iter()
                .map(|path| ModelEntry {
                    metadata: serde_json::from_value(json!({
                        "path": path,
                        "title": path,
                        "description": "",
                        "tags": [],
                        "relatedDocs": [],
                        "isIndex": false,
                        "source": {"path": format!("specs/{path}.page.html"), "line": 1, "column": 1},
                        "rootIndex": 0
                    }))
                    .unwrap(),
                    content: EntryContent::Page,
                })
                .collect(),
            folders: vec![],
            sources: vec![],
            color_schemes: vec![],
        },
        &[],
        &Publication {
            config_path: "mokly.config.json".into(),
            deployment_id: "e".repeat(64),
            revision: 0,
            base: None,
            changes_status: ChangesStatus::Disabled,
            live_generation: None,
        },
    )
}

fn page_detail(index: &CatalogueReadModel, path: &str) -> EntryDetailV4 {
    EntryDetailV4 {
        schema_version: 4,
        identity: index.identity.clone(),
        detail_id: String::new(),
        revision: Some(0),
        entry: DetailEntry {
            path: path.into(),
            kind: EntryKind::Page,
            snapshot_id: None,
        },
        views: vec![],
        reasons: None,
        before: None,
        resource_evidence: None,
        workspace: None,
        control_order: None,
    }
}

fn find_file<'a>(files: &'a Inventory, path: &str) -> &'a File {
    files.files().find(|file| file.path == path).unwrap()
}

#[test]
fn output_identity_is_order_and_location_independent_and_sensitive_to_content() {
    let mut a = index();
    let mut b = index();
    let seed = [
        ("z", b"deploymentId is consumer content".as_slice()),
        ("a", b"a".as_slice()),
    ];
    let mut first = Inventory::default();
    for (path, bytes) in seed {
        first.insert(path.into(), bytes.into()).unwrap();
    }
    let mut second = Inventory::default();
    for (path, bytes) in seed.into_iter().rev() {
        second.insert(path.into(), bytes.into()).unwrap();
    }
    finalize(&mut a, &mut BTreeMap::new(), &mut first).unwrap();
    finalize(&mut b, &mut BTreeMap::new(), &mut second).unwrap();
    assert_eq!(a.deployment_id, b.deployment_id);
    assert_eq!(
        find_file(&first, "mokly-viewer/index.json").bytes,
        find_file(&second, "mokly-viewer/index.json").bytes
    );
    let root_a = Artifact::finalize("/one".into(), first, None).unwrap();
    let root_b = Artifact::finalize("/two".into(), second, None).unwrap();
    assert_eq!(
        root_a.files.last().unwrap().bytes,
        root_b.files.last().unwrap().bytes
    );
    let mut zero = a.clone();
    zero.deployment_id = "0".repeat(64);
    let hashes = vec![
        ("a", digest(b"a")),
        ("mokly-viewer/index.json", digest(&json(&zero))),
        ("z", digest(b"deploymentId is consumer content")),
    ];
    assert_eq!(a.deployment_id, digest(&json(&hashes)));
    let mut changed = Inventory::default();
    changed
        .insert("a".into(), b"changed".as_slice().into())
        .unwrap();
    changed.insert("z".into(), seed[0].1.into()).unwrap();
    finalize(&mut b, &mut BTreeMap::new(), &mut changed).unwrap();
    assert_ne!(a.deployment_id, b.deployment_id);
}

#[test]
fn finalize_reuses_unchanged_detail_bytes_and_ids_and_hashes_typed_details() {
    let paths = ["one", "two"];
    let mut first_index = page_index(&paths);
    let mut first_details = paths
        .iter()
        .map(|path| ((*path).into(), page_detail(&first_index, path)))
        .collect();
    let mut first_files = Inventory::default();
    finalize(&mut first_index, &mut first_details, &mut first_files).unwrap();

    let mut second_index = page_index(&paths);
    let mut second_details = paths
        .iter()
        .map(|path| ((*path).into(), page_detail(&second_index, path)))
        .collect::<BTreeMap<_, _>>();
    second_details.get_mut("one").unwrap().reasons = Some(vec![EntryChangeReason::Material]);
    let mut second_files = Inventory::default();
    finalize(&mut second_index, &mut second_details, &mut second_files).unwrap();

    assert_eq!(
        find_file(&first_files, "mokly-viewer/entries/two.json").bytes,
        find_file(&second_files, "mokly-viewer/entries/two.json").bytes
    );
    assert_eq!(
        first_details["two"].detail_id,
        second_details["two"].detail_id
    );
    assert_ne!(
        first_details["one"].detail_id,
        second_details["one"].detail_id
    );
    for (index, files) in [(&first_index, &first_files), (&second_index, &second_files)] {
        for path in paths {
            let detail = readers::detail(
                std::str::from_utf8(
                    &find_file(files, &format!("mokly-viewer/entries/{path}.json")).bytes,
                )
                .unwrap(),
            )
            .unwrap();
            assert_eq!(detail.detail_id, canonical::detail_id(&detail).unwrap());
            assert_eq!(
                index
                    .pages
                    .iter()
                    .find(|entry| entry.entry.path == path)
                    .unwrap()
                    .entry
                    .detail_id,
                detail.detail_id
            );
        }
    }
}
