//! Completion keeps storage failures retryable and resolves missing-file races.

use std::sync::atomic::Ordering;

use mkc_store_interface::publication::PublicationState;

use crate::error::Error;
use crate::ingest::Ingest;
use crate::tests::support::{PUBLICATION, publication};

use super::authorization;
use super::storage_fixture::{Fixture, Scenario, WINNER};

fn retryable(scenario: Scenario, expected_writes: usize) {
    let fixture = Fixture::new(scenario);
    let result = fixture.ingest.complete(authorization(), PUBLICATION);
    assert!(
        matches!(result, Err(Error::Internal(_))),
        "{scenario:?}: {result:?}"
    );
    assert_eq!(
        fixture.writes.load(Ordering::SeqCst),
        expected_writes,
        "{scenario:?}: no publication or failure-cleanup transaction"
    );
}

#[test]
fn missing_detail_keeps_a_live_upload_retryable() {
    retryable(Scenario::MissingDetail, 1);
}

#[test]
fn detail_read_failure_keeps_the_upload_retryable() {
    retryable(Scenario::DetailRead, 0);
}

#[test]
fn detail_size_mismatch_keeps_the_upload_retryable() {
    retryable(Scenario::DetailSize, 0);
}

#[test]
fn index_size_mismatch_keeps_the_upload_retryable() {
    retryable(Scenario::IndexSize, 0);
}

#[test]
fn reference_list_failure_keeps_the_upload_retryable() {
    retryable(Scenario::ReferenceList, 0);
}

#[test]
fn missing_detail_returns_the_concurrent_winner() {
    let fixture = Fixture::new(Scenario::ConcurrentWinner);
    let result = fixture.ingest.complete(authorization(), PUBLICATION);
    assert!(
        matches!(&result, Ok(done) if done.publication.id == WINNER && done.replay),
        "{result:?}"
    );
    let done = result.unwrap();
    assert_eq!(done.publication.state, PublicationState::Ready);
    assert_eq!(done.publication.metadata, publication().metadata);
    assert_eq!(done.publication.changes, publication().changes);
    assert_eq!(
        fixture.writes.load(Ordering::SeqCst),
        1,
        "only the final state-resolution transaction runs"
    );
}
