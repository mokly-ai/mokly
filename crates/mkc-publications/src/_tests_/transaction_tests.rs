//! Store retries preserve typed policy rejection and source errors.

use std::sync::Arc;

use mkc_store_interface::store::{Decision, StoreMock};
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::transaction::{StoreTransactions, Transactions};

#[test]
fn policies_roll_back_without_becoming_internal_failures() {
    let store = Unimock::new(
        StoreMock::transaction
            .next_call(matching!(_))
            .answers(&|_, work| {
                assert_eq!(work.run(&mut Unimock::new(())).unwrap(), Decision::Rollback);
                Ok(())
            }),
    );
    let transactions = StoreTransactions {
        store: Arc::new(store),
    };
    assert!(matches!(
        transactions.run(false, &mut |_| Err(Error::Forbidden)),
        Err(Error::Forbidden)
    ));
}

#[test]
fn retry_clears_the_previous_attempts_policy_result() {
    let store = Unimock::new(
        StoreMock::transaction
            .next_call(matching!(_))
            .answers(&|_, work| {
                assert_eq!(work.run(&mut Unimock::new(())).unwrap(), Decision::Rollback);
                assert_eq!(work.run(&mut Unimock::new(())).unwrap(), Decision::Commit);
                Ok(())
            }),
    );
    let transactions = StoreTransactions {
        store: Arc::new(store),
    };
    let mut first = true;
    transactions
        .run(false, &mut |_| {
            if first {
                first = false;
                Err(Error::Forbidden)
            } else {
                Ok(())
            }
        })
        .unwrap();
}

#[test]
fn read_only_and_internal_errors_use_the_store_contract() {
    let store = Unimock::new(
        StoreMock::read
            .next_call(matching!(_))
            .answers(&|_, work| work.run(&mut Unimock::new(())).map(|_| ())),
    );
    let transactions = StoreTransactions {
        store: Arc::new(store),
    };
    assert!(matches!(
        transactions.run(true, &mut |_| Err(Error::internal(Error::Unavailable))),
        Err(Error::Internal(_))
    ));
}
