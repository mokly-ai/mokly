//! A transaction retry must sample the live ownership clock again after locks.

use std::sync::{Arc, Mutex};
use std::time;

use chrono::Duration;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use mkc_store_interface::build_state::BuildState;
use mkc_store_interface::error::Error;
use mkc_store_interface::store::Callback;
use unimock::{MockFn, Unimock, matching};

use crate::connection::{PgStoreFactory, StoreFactory};
use crate::runtime::RuntimeMock;

use super::grant_tests::grant;
use super::support::{attempt, finish, fixture};

#[test]
fn all_ownership_guards_sample_again_on_a_transaction_retry() {
    for operation in ["claim", "renew", "consume"] {
        let Some(f) = fixture() else { return };
        let build = f.build("main", 1);
        f.schedule(&build);
        let a = attempt(f.now);
        let g = grant(build.id, &a);
        let publication = f.publication(&build);
        f.store
            .transaction(&mut Callback(&mut |q| {
                q.start_build(build.id, &a)?.unwrap();
                q.mint_build_grant(&g)?;
                q.insert_publication(&publication)
            }))
            .unwrap();
        let current = Arc::new(Mutex::new(f.now + Duration::seconds(30)));
        let next = current.clone();
        let after = f.now + Duration::seconds(130);
        let retry = Unimock::new((
            RuntimeMock::jitter
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    *next.lock().unwrap() = after;
                    Ok(time::Duration::ZERO)
                })),
            RuntimeMock::sleep.some_call(matching!(_)).returns(()),
        ));
        let store = PgStoreFactory {
            runtime: Arc::new(retry),
        }
        .connect(f.schema.scoped_url())
        .unwrap();
        let mut calls = 0;
        let mut outcomes = Vec::new();
        store
            .transaction(&mut Callback(&mut |q| {
                calls += 1;
                let clock = || *current.lock().unwrap();
                let owned = match operation {
                    "claim" => {
                        let candidate = q.claim_build(&clock)?;
                        if let Some(candidate) = &candidate {
                            q.finish_build(
                                candidate.id,
                                candidate.lease_token,
                                &finish(clock(), BuildState::Queued),
                            )?;
                        }
                        candidate.is_some()
                    }
                    "renew" => {
                        q.renew_build(build.id, a.lease_token, &clock, Duration::minutes(2))?
                    }
                    _ => q.consume_build_grant(g.id, publication.id, &clock)?,
                };
                outcomes.push(owned);
                if calls == 1 {
                    return Err(Error::internal(DieselError::DatabaseError(
                        DatabaseErrorKind::SerializationFailure,
                        Box::new("controlled serialization conflict".to_owned()),
                    )));
                }
                Ok(())
            }))
            .unwrap();
        assert_eq!(calls, 2);
        assert_eq!(
            outcomes,
            if operation == "claim" {
                [false, true]
            } else {
                [true, false]
            }
        );
        store
            .read(&mut Callback(&mut |q| {
                assert!(
                    q.build_grant(&g.token_digest)?
                        .unwrap()
                        .consumed_at
                        .is_none()
                );
                let stored = q.build_by_id(build.id)?.unwrap();
                assert!(stored.publication_id.is_none());
                if operation != "claim" {
                    assert_eq!(stored.lease_expires_at, Some(a.lease_expires_at));
                }
                Ok(())
            }))
            .unwrap();
    }
}
