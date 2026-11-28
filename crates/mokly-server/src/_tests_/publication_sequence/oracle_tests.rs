//! Successive edits keep every served byte and detail id of each publication, and a shared
//! detail keeps the typed revision of the publication that built it.

use std::fmt::Write;
use std::sync::Arc;

use axum::body::to_bytes;
use mokly_model::namespace::viewer;
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::usage::CatalogueUsage;

use crate::changes::ChangeToken;
use crate::detail_encoding::EncodedDetails;
use crate::evidence;
use crate::publication::{Publications, SharedPublication};
use crate::publication_support::ready;
use crate::snapshot::{Snapshot, SnapshotFactory};

use super::support::{accepted, generation, input, projector};

async fn record(output: &mut String, label: &str, snapshot: &Snapshot) {
    writeln!(
        output,
        "=== {label}, revision {} ===",
        snapshot.index.revision
    )
    .unwrap();
    for (path, detail) in &snapshot.details {
        writeln!(
            output,
            "{path}: {}, typed revision {:?}",
            detail.detail_id, detail.revision
        )
        .unwrap();
    }
    for (route, file) in &snapshot.files {
        let response = file.response(snapshot.index.revision);
        let length = response.headers()["content-length"]
            .to_str()
            .unwrap()
            .to_owned();
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(length, body.len().to_string(), "{label}: {route}");
        writeln!(
            output,
            "--- {route} ---\n{}",
            std::str::from_utf8(&body).unwrap()
        )
        .unwrap();
    }
    assert!(snapshot.files.contains_key(&viewer("index.json")));
}

fn status(current: Arc<Snapshot>, status: ChangesStatus, edit: usize) -> Arc<Snapshot> {
    let shared = SharedPublication::new(current.clone());
    assert!(
        shared
            .changes(
                &current,
                status,
                (status == ChangesStatus::Ready).then(|| accepted(
                    current.details.len(),
                    edit,
                    current
                        .details
                        .values()
                        .all(|detail| detail.workspace.is_some())
                )),
                &ChangeToken::default(),
                None,
            )
            .unwrap()
    );
    shared.current()
}

#[tokio::test]
async fn several_edits_keep_every_byte_and_id_and_shared_details_keep_their_built_revision() {
    let projector = projector();
    let mut current = projector.create(generation(2, 0), input(1)).unwrap();
    let mut output = String::new();
    for edit in 0..3 {
        if edit > 0 {
            current = projector
                .replace(
                    generation(2, edit),
                    input(current.index.revision + 1),
                    &current,
                )
                .unwrap();
        }
        record(&mut output, &format!("edit {edit}: rebuild"), &current).await;
        let first = current.routes[0].route.clone();
        current = evidence::complete(&current, &[(first, ready())], &EncodedDetails)
            .unwrap()
            .unwrap();
        record(
            &mut output,
            &format!("edit {edit}: foreground usage"),
            &current,
        )
        .await;
        current = status(current, ChangesStatus::Preparing, edit);
        record(&mut output, &format!("edit {edit}: preparing"), &current).await;
        let updates: Vec<_> = current
            .routes
            .iter()
            .map(|route| {
                (
                    route.route.clone(),
                    if edit == 2 && route.path == "screen-1" {
                        CatalogueUsage::Unavailable
                    } else {
                        ready()
                    },
                )
            })
            .collect();
        current = evidence::complete(&current, &updates, &EncodedDetails)
            .unwrap()
            .unwrap();
        record(
            &mut output,
            &format!("edit {edit}: complete usage"),
            &current,
        )
        .await;
        current = status(current, ChangesStatus::Ready, edit);
        record(
            &mut output,
            &format!("edit {edit}: ready Changes"),
            &current,
        )
        .await;
        for phase in [
            ChangesStatus::Pending,
            ChangesStatus::Disabled,
            ChangesStatus::Preparing,
        ] {
            current = status(current, phase, edit);
            record(&mut output, &format!("edit {edit}: {phase:?}"), &current).await;
        }
    }
    insta::with_settings!({
        description => "The served bytes and the detail ids equal those of the publication \
            algorithm at main 794b30a91, encoded as compact JSON. Each typed revision follows the sharing rule of the \
            mokly-server README: a shared detail keeps the typed revision of the publication that \
            built it.",
    }, {
        insta::assert_snapshot!(output);
    });
}
