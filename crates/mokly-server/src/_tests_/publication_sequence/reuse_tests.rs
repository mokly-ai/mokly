//! Equal phase records avoid repeated hash and encoding work after source edits.

use std::sync::Arc;

use mokly_model::public_metadata::ChangesStatus;
use mokly_test_support::capture::Trace;

use crate::changes::ChangeToken;
use crate::detail_encoding::EncodedDetails;
use crate::evidence;
use crate::publication::{Publications, SharedPublication};
use crate::publication_support::ready;
use crate::snapshot::{Snapshot, SnapshotFactory};

use super::support::{accepted, generation, input, keyed, projector};

/// Complete the usage of every view of `current` that its rebuild did not reuse.
fn used(current: &Snapshot) -> Arc<Snapshot> {
    let updates: Vec<_> = current
        .routes
        .iter()
        .map(|route| (route.route.clone(), ready()))
        .collect();
    evidence::complete(current, &updates, &EncodedDetails)
        .unwrap()
        .unwrap()
}

#[test]
fn each_rebuild_keeps_the_record_of_its_usage_shape() {
    let traces = Trace::default();
    traces.in_scope(|| {
        let builds = || traces.closed("detail.build").len();
        let projector = projector();
        let mut current = used(&projector.create(generation(4, 0), input(1)).unwrap());
        let edits: [(&str, &dyn Fn(usize) -> usize); 3] = [
            ("a narrow edit", &|entry| usize::from(entry == 0)),
            ("an edit that moves every view", &|_| 2),
            ("a narrow edit after it", &|entry| {
                if entry == 0 { 3 } else { 2 }
            }),
        ];
        let mut counts = Vec::new();
        for (edit, (_, key)) in edits.iter().enumerate() {
            let before = builds();
            current = projector
                .replace(
                    keyed(4, edit + 1, *key),
                    input(current.index.revision + 1),
                    &current,
                )
                .unwrap();
            counts.push(builds() - before);
            current = used(&current);
        }
        assert_eq!(
            counts,
            [3, 0, 0],
            "{:?}: the unchanged details of the first edit are new; the second edit shares the \
             pending records of the startup, and the third the ready records of the first edit",
            edits.map(|(name, _)| name)
        );
    });
}

#[test]
fn repeated_edit_phases_do_not_build_equal_details_again_at_either_catalogue_size() {
    for count in [4, 16] {
        let traces = Trace::default();
        traces.in_scope(|| {
            let builds = || traces.closed("detail.build").len();
            let projector = projector();
            let mut current = projector.create(generation(count, 0), input(1)).unwrap();
            assert_eq!(builds(), count);
            for edit in 0..3 {
                let before = builds();
                if edit > 0 {
                    current = projector
                        .replace(
                            generation(count, edit),
                            input(current.index.revision + 1),
                            &current,
                        )
                        .unwrap();
                }
                assert_eq!(
                    builds() - before,
                    0,
                    "{count} entries, edit {edit}: rebuild"
                );
                let before = builds();
                let updates = current
                    .routes
                    .iter()
                    .map(|route| (route.route.clone(), ready()))
                    .collect::<Vec<_>>();
                current = evidence::complete(&current, &updates, &EncodedDetails)
                    .unwrap()
                    .unwrap();
                assert_eq!(current.completed.len(), count * 2);
                assert_eq!(
                    builds() - before,
                    if edit == 0 { count } else { 0 },
                    "{count} entries, edit {edit}: usage"
                );
                let before = builds();
                let shared = SharedPublication::new(current.clone());
                assert!(
                    shared
                        .changes(
                            &current,
                            ChangesStatus::Ready,
                            Some(accepted(count, edit, true)),
                            &ChangeToken::default(),
                            None
                        )
                        .unwrap()
                );
                current = shared.current();
                assert_eq!(
                    builds() - before,
                    if edit == 0 { count } else { 0 },
                    "{count} entries, edit {edit}: ready Changes"
                );
                let before = builds();
                let mut statuses = Vec::new();
                for status in [
                    ChangesStatus::Preparing,
                    ChangesStatus::Pending,
                    ChangesStatus::Disabled,
                ] {
                    assert!(
                        shared
                            .changes(&current, status, None, &ChangeToken::default(), None)
                            .unwrap()
                    );
                    current = shared.current();
                    statuses.push(current.clone());
                }
                assert_eq!(
                    builds() - before,
                    0,
                    "{count} entries, edit {edit}: status Changes"
                );
                for (path, detail) in &current.details {
                    assert!(
                        Arc::ptr_eq(detail, &statuses[0].details[path]),
                        "{count} entries, edit {edit}: {path} shares the equal status detail"
                    );
                }
            }
        });
    }
}
