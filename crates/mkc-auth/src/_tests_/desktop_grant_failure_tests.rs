//! Invalid grants keep one public failure and retain committed admission.

use std::sync::Arc;

use chrono::Duration;
use mkc_store_interface::desktop_grant::{DesktopGrant, DesktopGrantsMock};
use mkc_store_interface::rate_limit::{RateLimit, RateLimitsMock};
use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::runtime::{RuntimeMock, hash};
use crate::service::{AuthService, Authenticator};

use super::support::{clock, identity, now, pure};

const GRANT: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const VERIFIER: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CHALLENGE: &str = "_-BU_nrgy23GXDr5th1SCfQ5hR20PQulmXM33xVGaOs";

fn stored() -> DesktopGrant {
    DesktopGrant {
        token_hash: hash(GRANT),
        challenge: CHALLENGE.into(),
        user_id: identity().user.id,
        return_to: "/dashboard".into(),
        expires_at: now() + Duration::minutes(5),
        session_expires_at: now() + Duration::hours(3),
        used_at: None,
    }
}

fn admission() -> Unimock {
    Unimock::new((
        RateLimitsMock::rate_limit
            .some_call(matching!(_))
            .returns(Ok(None)),
        RateLimitsMock::insert_rate_limit
            .some_call(matching!(_))
            .returns(Ok(())),
    ))
}

fn rejecting_exchange(record: Option<DesktopGrant>) -> AuthService {
    let admission = admission();
    let queries = Unimock::new(
        DesktopGrantsMock::desktop_grant
            .some_call(matching!((key,) if key == &hash(GRANT)))
            .returns(Ok(record)),
    );
    let store = Unimock::new((
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                assert_eq!(work.run(&mut admission.clone())?, Decision::Commit);
                Ok(())
            })),
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                assert_eq!(work.run(&mut queries.clone())?, Decision::Rollback);
                Ok(())
            })),
    ));
    let mut auth = pure();
    auth.store = Arc::new(store);
    auth.runtime = Arc::new(Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now()),
        RuntimeMock::secret
            .each_call(matching!())
            .answers(&|_| Ok("fresh".into())),
    )));
    auth
}

#[test]
fn desktop_grant_unknown_expired_used_and_wrong_verifier_share_one_reason_without_consumption() {
    let mut expired = stored();
    expired.expires_at = now();
    let mut used = stored();
    used.used_at = Some(now() - Duration::seconds(1));
    let mut deadline = stored();
    deadline.session_expires_at = now();
    for (record, verifier) in [
        (None, VERIFIER.to_owned()),
        (Some(expired), VERIFIER.to_owned()),
        (Some(used), VERIFIER.to_owned()),
        (Some(deadline), VERIFIER.to_owned()),
        (Some(stored()), "c".repeat(64)),
    ] {
        assert!(matches!(
            rejecting_exchange(record).exchange_desktop_grant(
                GRANT,
                &verifier,
                Some("old"),
                "127.0.0.1"
            ),
            Err(Error::InvalidDesktopGrant)
        ));
    }
}

#[test]
fn desktop_grant_malformed_credentials_and_challenges_commit_admission_before_rejection() {
    for (issue, malformed_verifier, value) in [
        (true, false, "a".repeat(42)),
        (true, false, "+".repeat(43)),
        (false, false, "A".repeat(64)),
        (false, false, "a".repeat(63)),
        (false, false, "f".repeat(65)),
        (false, false, "é".repeat(32)),
        (false, true, "a".repeat(63)),
        (false, true, "A".repeat(64)),
    ] {
        let queries = admission();
        let mut auth = pure();
        auth.runtime = Arc::new(clock());
        auth.store = Arc::new(Unimock::new(
            StoreMock::transaction
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                    assert_eq!(work.run(&mut queries.clone())?, Decision::Commit);
                    Ok(())
                })),
        ));
        let result = if issue {
            auth.issue_desktop_grant(&identity(), &value, None, "127.0.0.1")
                .map(|_| ())
        } else {
            let (grant, verifier) = if malformed_verifier {
                (GRANT, value.as_str())
            } else {
                (value.as_str(), VERIFIER)
            };
            auth.exchange_desktop_grant(grant, verifier, None, "127.0.0.1")
                .map(|_| ())
        };
        assert!(matches!(result, Err(Error::InvalidDesktopGrant)));
    }
}

#[test]
fn desktop_grant_each_endpoint_admits_twenty_then_rejects_and_resets_at_the_boundary() {
    for (issue, endpoint) in [(true, "issue"), (false, "exchange")] {
        for (count, seconds, expected) in [(19, 10, None), (20, 1, Some(1)), (20, 0, None)] {
            let key = hash(&format!("desktop-grant-{endpoint}:127.0.0.1"));
            let read = RateLimitsMock::rate_limit
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, actual| {
                    assert_eq!(actual, key);
                    Ok(Some(RateLimit {
                        key: key.clone(),
                        count,
                        resets_at: now() + Duration::seconds(seconds),
                    }))
                }));
            let queries = if expected.is_none() {
                Unimock::new((
                    read,
                    RateLimitsMock::save_rate_limit
                        .some_call(matching!(_))
                        .answers_arc(Arc::new(move |_, rate| {
                            assert_eq!(rate.count, if seconds == 0 { 1 } else { 20 });
                            assert_eq!(
                                rate.resets_at,
                                now() + Duration::seconds(if seconds == 0 { 60 } else { seconds })
                            );
                            Ok(())
                        })),
                ))
            } else {
                Unimock::new(read)
            };
            let mut auth = pure();
            auth.runtime = Arc::new(clock());
            auth.store = Arc::new(Unimock::new(
                StoreMock::transaction
                    .some_call(matching!(_))
                    .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                        work.run(&mut queries.clone()).map(|_| ())
                    })),
            ));
            let result = if issue {
                auth.issue_desktop_grant(&identity(), "bad", None, "127.0.0.1")
                    .map(|_| ())
            } else {
                auth.exchange_desktop_grant("bad", VERIFIER, None, "127.0.0.1")
                    .map(|_| ())
            };
            let outcome = match result {
                Err(Error::RateLimited(retry)) => Some(retry),
                Err(Error::InvalidDesktopGrant) => None,
                _ => panic!("unexpected authentication outcome"),
            };
            assert_eq!(outcome, expected);
        }
    }
}
