//! Exact expiry boundaries and CSRF binding.

use std::sync::Arc;

use chrono::Duration;
use mkc_domain::client_origins::AdmittedOrigins;
use mkc_store_interface::session::SessionsMock;
use mkc_store_interface::store::{StoreMock, Transaction};
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::runtime::hash;
use crate::service::{AuthService, Authenticator};

use super::support::{clock, identity, now, pure, read_service};

#[test]
fn both_idle_and_absolute_deadlines_reject_at_the_exact_boundary() {
    for idle in [true, false] {
        let mut session = identity().session;
        if idle {
            session.last_seen_at = now() - Duration::days(7);
        } else {
            session.expires_at = now();
        }
        let query = Unimock::new(
            SessionsMock::session
                .next_call(matching!(_))
                .returns(Ok(Some(session))),
        );
        let auth = read_service(query, Arc::new(Unimock::new(())), clock());
        assert!(matches!(
            auth.authenticate("cookie"),
            Err(Error::SessionExpired)
        ));
    }
}

#[test]
fn fresh_session_reads_never_write_activity() {
    let original = identity();
    let query = Unimock::new((
        SessionsMock::session
            .next_call(matching!(_))
            .returns(Ok(Some(original.session.clone()))),
        UsersMock::user
            .next_call(matching!(_))
            .returns(Ok(Some(original.user))),
    ));
    let auth = read_service(query, Arc::new(Unimock::new(())), clock());
    assert!(auth.authenticate("cookie").is_ok());
}

#[test]
fn csrf_requires_both_exact_origin_and_bound_token() {
    let auth = pure();
    for (origin, token) in [
        (None, Some("csrf")),
        (Some("https://evil.test"), Some("csrf")),
        (Some("https://app.example.com"), None),
        (Some("https://app.example.com"), Some("wrong")),
    ] {
        assert!(matches!(
            auth.csrf(&identity(), origin, token),
            Err(Error::CsrfFailed)
        ));
    }
    assert!(
        auth.csrf(&identity(), Some("https://app.example.com"), Some("csrf"))
            .is_ok()
    );
}

#[test]
fn five_minute_touch_threshold_is_strict_and_touch_is_outside_the_read() {
    for age in [
        Duration::minutes(5),
        Duration::minutes(5) + Duration::seconds(1),
    ] {
        let mut original = identity();
        original.session.last_seen_at = now() - age;
        let queries = Unimock::new((
            SessionsMock::session
                .next_call(matching!(_))
                .returns(Ok(Some(original.session.clone()))),
            UsersMock::user
                .next_call(matching!(_))
                .returns(Ok(Some(original.user))),
        ));
        let read = StoreMock::read
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                work.run(&mut queries.clone()).map(|_| ())
            }))
            .once();
        let store = if age > Duration::minutes(5) {
            let touch = Unimock::new(SessionsMock::touch
                .next_call(matching!((h, at, before) if h == &hash("cookie") && *at == now() && *before == now() - Duration::minutes(5)))
                .returns(Ok(())));
            Unimock::new((
                read,
                StoreMock::autocommit
                    .next_call(matching!(_))
                    .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                        work.run(&mut touch.clone()).map(|_| ())
                    }))
                    .once(),
            ))
        } else {
            Unimock::new(read)
        };
        let auth = AuthService {
            store: Arc::new(store),
            mailer: Arc::new(Unimock::new(())),
            runtime: Arc::new(clock()),
            origins: AdmittedOrigins::new("https://app.example.com".into(), false),
            preview_sign_in: None,
        };
        let result = auth.authenticate("cookie").unwrap();
        assert_eq!(
            result.session.last_seen_at,
            if age > Duration::minutes(5) {
                now()
            } else {
                now() - age
            }
        );
    }
}
