//! Maintenance exhausts both continuation families and rejects unsafe stalls.

use std::sync::Arc;

use mkc_domain::ids::PublicationId;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::Error;
use crate::garbage_collection::{CollectionReport, GarbageCollectorMock};
use crate::maintenance::{Maintenance, MaintenanceReport, PublicationMaintenance};
use crate::retention::{RetentionReport, RetentionWorkerMock};

const FIRST: PublicationId = PublicationId(Uuid::from_u128(10));

#[test]
fn empty_cycle_succeeds_without_inventing_work() {
    let maintenance: &dyn PublicationMaintenance = &Maintenance {
        retention: Arc::new(Unimock::new(
            RetentionWorkerMock::run_batch
                .next_call(matching!(None))
                .returns(Ok(RetentionReport::default())),
        )),
        garbage: Arc::new(Unimock::new(
            GarbageCollectorMock::run_batch
                .next_call(matching!(None))
                .returns(Ok(CollectionReport::default())),
        )),
    };
    assert_eq!(maintenance.run().unwrap(), MaintenanceReport::default());
}

#[test]
fn exhausts_publication_and_object_continuations() {
    let maintenance: &dyn PublicationMaintenance = &Maintenance {
        retention: Arc::new(Unimock::new((
            RetentionWorkerMock::run_batch
                .next_call(matching!(None))
                .returns(Ok(RetentionReport {
                    next: Some(FIRST),
                    abandoned: 2,
                    pruned: 3,
                })),
            RetentionWorkerMock::run_batch
                .next_call(matching!(Some(FIRST)))
                .returns(Ok(RetentionReport {
                    pruned: 4,
                    ..RetentionReport::default()
                })),
        ))),
        garbage: Arc::new(Unimock::new((
            GarbageCollectorMock::run_batch
                .next_call(matching!(None))
                .returns(Ok(CollectionReport {
                    blobs: 100,
                    orphans: 5,
                    more_blobs: true,
                    next_cursor: Some("objects-100".into()),
                })),
            GarbageCollectorMock::run_batch
                .next_call(matching!(Some("objects-100")))
                .returns(Ok(CollectionReport {
                    blobs: 4,
                    orphans: 2,
                    ..CollectionReport::default()
                })),
        ))),
    };
    assert_eq!(
        maintenance.run().unwrap(),
        MaintenanceReport {
            abandoned: 2,
            pruned: 7,
            blobs: 104,
            orphans: 7,
        }
    );
}

#[test]
fn repeated_continuations_fail_instead_of_looping() {
    let maintenance: &dyn PublicationMaintenance = &Maintenance {
        retention: Arc::new(Unimock::new((
            RetentionWorkerMock::run_batch
                .next_call(matching!(None))
                .returns(Ok(RetentionReport {
                    next: Some(FIRST),
                    ..RetentionReport::default()
                })),
            RetentionWorkerMock::run_batch
                .next_call(matching!(Some(FIRST)))
                .returns(Ok(RetentionReport {
                    next: Some(FIRST),
                    ..RetentionReport::default()
                })),
        ))),
        garbage: Arc::new(Unimock::new(())),
    };
    assert!(matches!(maintenance.run(), Err(Error::Unavailable)));
}

#[test]
fn collection_failure_remains_retryable() {
    let maintenance: &dyn PublicationMaintenance = &Maintenance {
        retention: Arc::new(Unimock::new(
            RetentionWorkerMock::run_batch
                .next_call(matching!(None))
                .returns(Ok(RetentionReport::default())),
        )),
        garbage: Arc::new(Unimock::new(
            GarbageCollectorMock::run_batch
                .next_call(matching!(None))
                .returns(Err(Error::Unavailable)),
        )),
    };
    assert!(matches!(maintenance.run(), Err(Error::Unavailable)));
}
