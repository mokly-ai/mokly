//! The composed worker states availability and runs the shared access rule.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use mkc_store_interface::project::ProjectsMock;
use tokio::sync::Semaphore;
use unimock::{MockFn, Unimock, matching};

use crate::build_eligibility::BuildEligibility;
use crate::build_worker::service::{BuildWorkerConfig, DatabaseBuildWorker};
use crate::tests::build_fixtures::PROJECT;

#[test]
fn a_composed_worker_explicitly_enables_the_shared_availability_check() {
    let empty = || Arc::new(Unimock::new(()));
    let worker = DatabaseBuildWorker {
        transactions: empty(),
        runtime: empty(),
        credentials: empty(),
        runner: empty(),
        clock: empty(),
        slots: Arc::new(Semaphore::new(1)),
        config: BuildWorkerConfig {
            api_origin: "https://api.example.com".into(),
            per_process: 1,
        },
    };
    let eligibility: &dyn BuildEligibility = &worker;
    assert!(eligibility.configured());
    let mut queries = Unimock::new(
        ProjectsMock::project
            .next_call(matching!(&PROJECT))
            .returns(Ok(None)),
    );
    assert!(eligibility.access(&mut queries, PROJECT).unwrap().is_none());
}
