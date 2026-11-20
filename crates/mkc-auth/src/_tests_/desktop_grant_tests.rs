//! Grant issue and exchange preserve the browser's account and absolute deadline.

use std::sync::Arc;

use chrono::Duration;
use mkc_store_interface::desktop_grant::{DesktopGrant, DesktopGrantsMock};
use mkc_store_interface::rate_limit::RateLimitsMock;
use mkc_store_interface::session::SessionsMock;
use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};

use crate::runtime::{RuntimeMock, hash};
use crate::service::Authenticator;

use super::support::{identity, now, pure, service};

const VERIFIER: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CHALLENGE: &str = "_-BU_nrgy23GXDr5th1SCfQ5hR20PQulmXM33xVGaOs";
const GRANT: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

fn grant() -> DesktopGrant {
    DesktopGrant {
        token_hash: hash(GRANT),
        challenge: CHALLENGE.into(),
        user_id: identity().user.id,
        return_to: "/acme/catalogue?branch=topic%2Fwork".into(),
        expires_at: now() + Duration::minutes(5),
        session_expires_at: now() + Duration::hours(3),
        used_at: None,
    }
}

#[test]
fn desktop_grant_issue_hashes_the_secret_and_caps_expiry_at_the_session_deadline() {
    for remaining in [Duration::hours(3), Duration::seconds(45)] {
        let mut browser = identity();
        browser.session.expires_at = now() + remaining;
        let deadline = browser.session.expires_at;
        let expires = now() + remaining.min(Duration::minutes(5));
        let queries = Unimock::new((
            RateLimitsMock::rate_limit.some_call(matching!((key,) if key == &hash("desktop-grant-issue:127.0.0.1"))).returns(Ok(None)),
            RateLimitsMock::insert_rate_limit.some_call(matching!((rate,) if rate.count == 1 && rate.resets_at == now() + Duration::seconds(60))).returns(Ok(())),
            DesktopGrantsMock::insert_desktop_grant.some_call(matching!(_)).answers_arc(Arc::new(move |_, record| {
                assert_eq!(record.token_hash, hash(GRANT));
                assert_eq!(record.challenge, CHALLENGE);
                assert_eq!(record.user_id, identity().user.id);
                assert_eq!(record.return_to, "/dashboard");
                assert_eq!(record.expires_at, expires);
                assert_eq!(record.session_expires_at, deadline);
                assert_eq!(record.used_at, None);
                Ok(())
            })),
        ));
        let auth = service(
            queries,
            Arc::new(Unimock::new(())),
            Unimock::new((
                RuntimeMock::now.each_call(matching!()).returns(now()),
                RuntimeMock::secret
                    .some_call(matching!())
                    .returns(Ok(GRANT.into())),
            )),
        );
        let result = auth.issue_desktop_grant(
            &browser,
            CHALLENGE,
            Some("https://third.example.com"),
            "127.0.0.1",
        );
        assert!(result.is_ok(), "desktop grant issue must succeed");
        let result = result.unwrap();
        assert_eq!(result.grant, GRANT);
        assert_eq!(result.expires_at, expires);
    }
}

#[test]
fn desktop_grant_exchange_revokes_the_previous_session_and_inherits_the_deadline() {
    let admission = Unimock::new((
        RateLimitsMock::rate_limit
            .some_call(matching!((key,) if key == &hash("desktop-grant-exchange:127.0.0.1")))
            .returns(Ok(None)),
        RateLimitsMock::insert_rate_limit
            .some_call(matching!(_))
            .returns(Ok(())),
    ));
    let queries = Unimock::new((
        DesktopGrantsMock::desktop_grant.some_call(matching!((key,) if key == &hash(GRANT))).returns(Ok(Some(grant()))),
        DesktopGrantsMock::consume_desktop_grant.some_call(matching!((key, at) if key == &hash(GRANT) && *at == now())).returns(Ok(true)),
        UsersMock::user.some_call(matching!((id,) if *id == identity().user.id)).returns(Ok(Some(identity().user))),
        SessionsMock::delete_session.some_call(matching!((key,) if key == &hash("old"))).returns(Ok(())),
        SessionsMock::insert_session.some_call(matching!((record,) if record.expires_at == now() + Duration::hours(3) && record.created_at == now() && record.last_seen_at == now() && record.csrf_token == "fresh" && record.token_hash == hash("fresh"))).returns(Ok(())),
    ));
    let mut auth = pure();
    auth.runtime = Arc::new(Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now()),
        RuntimeMock::secret
            .each_call(matching!())
            .answers(&|_| Ok("fresh".into())),
    )));
    auth.store = Arc::new(Unimock::new((
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                assert_eq!(work.run(&mut admission.clone())?, Decision::Commit);
                Ok(())
            })),
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                assert_eq!(work.run(&mut queries.clone())?, Decision::Commit);
                Ok(())
            })),
    )));
    let result = auth.exchange_desktop_grant(GRANT, VERIFIER, Some("old"), "127.0.0.1");
    assert!(result.is_ok(), "desktop grant exchange must succeed");
    let result = result.unwrap();
    assert_eq!(
        result.session.identity.session.expires_at,
        now() + Duration::hours(3)
    );
    assert_eq!(result.return_to, "/acme/catalogue?branch=topic%2Fwork");
}
