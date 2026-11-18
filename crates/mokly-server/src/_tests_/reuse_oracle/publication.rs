//! Serialize the actual Serve projection, metadata, and selected snapshot builders.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::diagnostic::normalize_warnings;
use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::review::ReviewKind;
use unimock::Unimock;

use crate::assets::File;
use crate::changes::{self, Accepted, ChangeToken};
use crate::comparison_capture::{Capturer, SnapshotCapture};
use crate::detail_encoding::EncodedDetails;
use crate::snapshot::{Projector, SnapshotFactory, SnapshotInput, encode};

#[derive(Debug, Eq, PartialEq)]
pub(super) struct Published {
    files: BTreeMap<String, (String, Vec<u8>)>,
    warnings: Vec<(&'static str, String, String)>,
    counts: (usize, usize, usize),
}

pub(super) fn publish(result: ComparisonResult) -> Published {
    let mut origin = Projector {
        deployment_id: "d".repeat(64),
        render_token: "e".repeat(64),
    }
    .create(
        result.after.clone(),
        SnapshotInput {
            documents: Arc::new(Unimock::new(())),
            revision: 1,
            config_path: "mokly.config.json".into(),
            base: Some("base".into()),
            assets: BTreeMap::new(),
        },
    )
    .unwrap();
    for plan in result.after.plans().values() {
        let path = &result.after.catalogue().model.entries[plan.entry]
            .metadata
            .path;
        let detail = Arc::make_mut(Arc::make_mut(&mut origin).details.get_mut(path).unwrap());
        for view in &mut detail.views {
            if Some(view.viewport) == plan.viewport && view.color_scheme == plan.color_scheme {
                view.usage = result.after.comparison_usage(&plan.route).unwrap().unwrap();
            }
        }
    }
    let accepted = Arc::new(Accepted {
        source: None,
        cancel: Arc::new(ChangeToken::default()),
        id: "f".repeat(64),
        result,
    });
    let current = changes::project(
        &origin,
        ChangesStatus::Ready,
        Some(accepted.clone()),
        &EncodedDetails,
    )
    .unwrap();
    let mut files = BTreeMap::new();
    insert(&mut files, "index.json".into(), encode(&current.index));
    for path in current.details.keys() {
        insert(
            &mut files,
            format!("entries/{path}.json"),
            encode(&current.detail(path).unwrap()),
        );
    }
    for (path, file) in changes::metadata(&accepted, &origin).unwrap() {
        insert(&mut files, format!("comparison/{path}"), file);
    }
    insert(
        &mut files,
        "review.json".into(),
        encode(&accepted.result.review),
    );
    insert(
        &mut files,
        "snapshot.json".into(),
        encode(&accepted.result.snapshot),
    );
    for entry in &accepted.result.review.entries {
        if !matches!(entry.kind, ReviewKind::Screen | ReviewKind::Component)
            || entry.after.is_none()
        {
            continue;
        }
        for (path, file) in SnapshotCapture
            .capture(
                &accepted,
                &entry.path,
                false,
                Arc::new(ChangeToken::default()),
            )
            .unwrap()
        {
            insert(&mut files, format!("selected/{}/{path}", entry.path), file);
        }
    }
    for entry in &accepted.result.snapshot.removed_entries {
        for (path, file) in SnapshotCapture
            .capture(
                &accepted,
                &entry.entry.metadata().path,
                true,
                Arc::new(ChangeToken::default()),
            )
            .unwrap()
        {
            insert(
                &mut files,
                format!("removed/{}/{path}", entry.entry.metadata().path),
                file,
            );
        }
    }
    let mut warnings = accepted.result.warnings.clone();
    normalize_warnings(&mut warnings);
    Published {
        files,
        warnings: warnings
            .iter()
            .map(|warning| {
                (
                    warning.code,
                    warning.printed_subject(),
                    warning.message.clone(),
                )
            })
            .collect(),
        counts: (
            accepted.result.counts.changes,
            accepted.result.counts.moved,
            accepted.result.counts.ignored_only,
        ),
    }
}
fn insert(files: &mut BTreeMap<String, (String, Vec<u8>)>, path: String, file: File) {
    files.insert(path, (file.content_type, file.bytes.to_vec()));
}
