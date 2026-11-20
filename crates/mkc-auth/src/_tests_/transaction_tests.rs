//! Caller-owned auth outcomes must roll back without leaking into the store contract.

use std::sync::Arc;

use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;

use super::failure_fixture::{assert_internal, failure};
use super::support::pure;

#[test]
fn auth_rejection_requests_rollback_and_retains_the_reason() {
    let mut service = pure();
    service.store = Arc::new(Unimock::new(
        StoreMock::transaction
            .next_call(matching!(_))
            .answers(&|_, work: &mut dyn Transaction| {
                assert_eq!(work.run(&mut Unimock::new(())).unwrap(), Decision::Rollback);
                Ok(())
            })
            .once(),
    ));
    assert!(matches!(
        service.transact(false, &mut |_| Err(Error::LinkUsed)),
        Err(Error::LinkUsed)
    ));
}

#[test]
fn transaction_boundary_failure_preserves_source_and_context() {
    for read_only in [true, false] {
        let mut service = pure();
        let store = if read_only {
            Unimock::new(
                StoreMock::read
                    .next_call(matching!(_))
                    .returns(Err(failure())),
            )
        } else {
            Unimock::new(
                StoreMock::transaction
                    .next_call(matching!(_))
                    .returns(Err(failure())),
            )
        };
        service.store = Arc::new(store);
        assert_internal(
            service.transact(read_only, &mut |_| Ok(())).unwrap_err(),
            if read_only {
                "read service state"
            } else {
                "commit service work"
            },
        );
    }
}
