//! Entropy failure occurs before any retryable transaction or provider call.

use std::io;
use std::sync::Arc;

use mkc_auth::runtime::RuntimeMock;
use mkc_store_interface::error::Error;
use unimock::{MockFn, Unimock, matching};

use crate::build_worker::service::{
    BuildWorkerConfig, BuildWorkerFactory, DatabaseBuildWorkerFactory,
};
use crate::tests::build_fixtures::LEASE;

#[test]
fn unavailable_entropy_never_claims_a_build() {
    let runtime = Unimock::new((
        RuntimeMock::id
            .each_call(matching!())
            .returns(LEASE)
            .n_times(3),
        RuntimeMock::secret
            .some_call(matching!())
            .returns(Err(Error::internal(io::Error::other(
                "entropy unavailable",
            )))),
    ));
    let factory: &dyn BuildWorkerFactory = &DatabaseBuildWorkerFactory {
        transactions: Arc::new(Unimock::new(())),
        runtime: Arc::new(runtime),
        credentials: Arc::new(Unimock::new(())),
        runner: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(())),
    };
    let worker = factory.create(BuildWorkerConfig {
        api_origin: "https://api.example.com".into(),
        per_process: 4,
    });
    assert!(worker.claim().is_err());
}
