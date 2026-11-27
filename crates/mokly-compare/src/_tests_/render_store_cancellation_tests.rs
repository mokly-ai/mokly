//! A cancelled index or access-order update is a normal event, not a store fault.

use std::io::Cursor;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use mokly_graph::document_store::ReadOutcome;
use mokly_sidecar::bundle_store::RecordToken;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_cache_types::{Mutation, RawEntry, RawRead};
use crate::error::Error;
use crate::render_segment_buffer::{Append, SegmentBuffer};
use crate::render_store::{CachedDocuments, DocumentBackend, SegmentCacheMock, WriteOutcome};

use super::render_store_boundary_tests::{encode, entry, records};

/// How the follow-up step after a durable publication ends.
#[derive(Clone, Copy, Debug)]
enum FollowUp {
    /// The startup inventory sees the command's cancellation.
    InventoryCancelled,
    /// The publication inspection sees the command's cancellation.
    InspectionCancelled,
    /// The publication inspection fails outside one entry.
    InspectionFailed,
}

fn unsafe_cache() -> Error {
    Error::UnsafeCache {
        path: PathBuf::from("/cache/renders"),
    }
}

fn store_after_write(follow_up: FollowUp) -> CachedDocuments {
    let cache = Unimock::new((
        SegmentCacheMock::replace
            .some_call(matching!(_, _))
            .returns(Ok(Mutation::Written)),
        SegmentCacheMock::entries
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| match follow_up {
                FollowUp::InventoryCancelled => Err(Error::Cancelled),
                FollowUp::InspectionCancelled | FollowUp::InspectionFailed => Ok(Some(vec![])),
            })),
        SegmentCacheMock::inspect
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| match follow_up {
                FollowUp::InspectionFailed => Err(unsafe_cache()),
                FollowUp::InventoryCancelled | FollowUp::InspectionCancelled => {
                    Err(Error::Cancelled)
                }
            })),
    ));
    CachedDocuments::new(Arc::new(cache), "current".into())
}

#[test]
fn a_write_cancelled_after_publication_stays_written_and_keeps_the_store_on() {
    let documents = records(1);
    for (follow_up, outcome, enabled) in [
        (FollowUp::InventoryCancelled, WriteOutcome::Written(1), true),
        (
            FollowUp::InspectionCancelled,
            WriteOutcome::Written(1),
            true,
        ),
        (
            FollowUp::InspectionFailed,
            WriteOutcome::WrittenWithStoreFault(1),
            false,
        ),
    ] {
        let store = store_after_write(follow_up);
        let mut buffer = SegmentBuffer::new(1024 * 1024).unwrap();
        assert_eq!(
            buffer.append(&documents[0].key, &documents[0].document, None),
            Append::Added
        );
        let built = buffer.finish("current").unwrap();
        assert_eq!(store.save(&built), outcome, "{follow_up:?}");
        assert_eq!(
            store.enabled.load(Ordering::Acquire),
            enabled,
            "{follow_up:?}"
        );
    }
}

fn outcome(read: &ReadOutcome) -> &'static str {
    match read {
        ReadOutcome::Hit(_) => "hit",
        ReadOutcome::HitWithStoreFault(_) => "hit with store fault",
        ReadOutcome::Miss => "miss",
        ReadOutcome::Rejected(_) => "rejected",
        ReadOutcome::RejectedWithStoreFault(_) => "rejected with store fault",
        ReadOutcome::Unavailable => "unavailable",
    }
}

#[test]
fn a_hit_with_cancelled_access_order_maintenance_keeps_the_store_on() {
    let documents = records(1);
    let bytes = encode(&documents, "current").unwrap();
    for (name, maintenance, expected, enabled) in [
        ("cancelled", Error::Cancelled, "hit", true),
        ("failed", unsafe_cache(), "hit with store fault", false),
    ] {
        let inspected = bytes.clone();
        let read = bytes.clone();
        let maintenance = Mutex::new(Some(maintenance));
        let cache = Unimock::new((
            SegmentCacheMock::entries
                .some_call(matching!())
                .returns(Ok(Some(vec!["segment".into()]))),
            SegmentCacheMock::inspect
                .some_call(matching!("segment"))
                .answers_arc(Arc::new(move |_, _| Ok(entry(inspected.clone())))),
            SegmentCacheMock::read
                .some_call(matching!("segment"))
                .answers_arc(Arc::new(move |_, _| {
                    Ok(RawRead::Entry(RawEntry {
                        bytes: read.len() as u64,
                        input: Box::new(Cursor::new(read.clone())),
                        token: RecordToken::new([7; 32]),
                        runtime_digest: [0; 32],
                        maintenance: maintenance.lock().unwrap().take(),
                        guard: Box::new(Unimock::new(())),
                    }))
                })),
        ));
        let store = CachedDocuments::new(Arc::new(cache), "current".into());
        assert_eq!(
            outcome(&DocumentBackend::initialize(&store)),
            "miss",
            "{name}"
        );
        assert_eq!(outcome(&store.load(&documents[0].key)), expected, "{name}");
        assert_eq!(store.enabled.load(Ordering::Acquire), enabled, "{name}");
    }
}
