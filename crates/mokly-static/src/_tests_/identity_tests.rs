//! Identity zeroes only public top-level fences and sorts by UTF-16 path order.

use std::collections::BTreeMap;

use mokly_model::catalogue::CatalogueModel;
use mokly_model::deployment::DeploymentFileV1;
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::validation::digest;
use mokly_model::projection::{self, Publication};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::versions;

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
    .unwrap()
}

#[test]
fn output_identity_is_order_and_location_independent_and_sensitive_to_content() {
    let mut a = index();
    let mut b = index();
    let files = vec![
        File {
            path: "z".into(),
            bytes: b"deploymentId is consumer content".as_slice().into(),
        },
        File {
            path: "a".into(),
            bytes: b"a".as_slice().into(),
        },
    ];
    let mut reversed = files.clone();
    reversed.reverse();
    let first = finalize(&mut a, &mut BTreeMap::new(), &files).unwrap();
    let second = finalize(&mut b, &mut BTreeMap::new(), &reversed).unwrap();
    assert_eq!(a.deployment_id, b.deployment_id);
    assert_eq!(first[0].bytes, second[0].bytes);
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
        ("mokly-viewer/index.json", digest(&json(&zero).unwrap())),
        ("z", digest(b"deploymentId is consumer content")),
    ];
    assert_eq!(a.deployment_id, digest(&json(&hashes).unwrap()));
    reversed[0].bytes = b"changed".as_slice().into();
    finalize(&mut b, &mut BTreeMap::new(), &reversed).unwrap();
    assert_ne!(a.deployment_id, b.deployment_id);
}

#[test]
fn deployment_file_is_written_after_and_excluded_from_identity() {
    let mut index = index();
    let content = vec![File {
        path: "content".into(),
        bytes: b"content".as_slice().into(),
    }];
    let records = finalize(&mut index, &mut BTreeMap::new(), &content).unwrap();
    let deployment = File {
        path: "mokly-viewer/deployment.json".into(),
        bytes: json(&DeploymentFileV1 {
            schema_version: versions::DEPLOYMENT_FILE,
            deployment_id: index.deployment_id.clone(),
        })
        .unwrap()
        .into(),
    };
    let mut output = content.clone();
    output.extend(records);
    output.push(deployment);
    let mut zero = index.clone();
    zero.deployment_id = "0".repeat(64);
    let mut hashes: Vec<_> = output
        .iter()
        .filter(|file| file.path != "mokly-viewer/deployment.json")
        .map(|file| {
            let bytes = if file.path == "mokly-viewer/index.json" {
                json(&zero).unwrap()
            } else {
                file.bytes.to_vec()
            };
            (file.path.clone(), digest(&bytes))
        })
        .collect();
    hashes.sort_by(|left, right| left.0.encode_utf16().cmp(right.0.encode_utf16()));
    assert_eq!(index.deployment_id, digest(&json(&hashes).unwrap()));
}
