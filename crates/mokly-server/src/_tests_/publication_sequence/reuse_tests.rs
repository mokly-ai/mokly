//! Equal phase records avoid repeated hash and encoding work after source edits.

use mokly_model::public_metadata::ChangesStatus;
use tracing_subscriber::layer::SubscriberExt;

use crate::changes::ChangeToken;
use crate::changes_trace_support::Traces;
use crate::detail_encoding::EncodedDetails;
use crate::evidence;
use crate::publication::{Publications, SharedPublication};
use crate::publication_support::ready;
use crate::snapshot::SnapshotFactory;

use super::support::{accepted, generation, input, projector};

#[test]
fn repeated_edit_phases_do_not_build_equal_details_again_at_either_catalogue_size() {
    for count in [4, 16] {
        let traces = Traces::default();
        let subscriber = tracing_subscriber::registry().with(traces.clone());
        tracing::subscriber::with_default(subscriber, || {
            let builds = || {
                traces
                    .records()
                    .iter()
                    .filter(|record| record.name == "detail.build")
                    .count()
            };
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
                }
                assert_eq!(
                    builds() - before,
                    0,
                    "{count} entries, edit {edit}: status Changes"
                );
                assert!(
                    current
                        .details
                        .values()
                        .all(|detail| detail.revision == Some(current.index.revision))
                );
            }
        });
    }
}
