//! Preview credentials count refusals and share ordinary session issuance.

use std::sync::Arc;

use chrono::Duration;
use mkc_store_interface::rate_limit::{RateLimit, RateLimitsMock};
use mkc_store_interface::session::SessionsMock;
use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::Error;
use crate::runtime::{RuntimeMock, hash};
use crate::service::{AuthService, Authenticator, PreviewSignIn};

use super::support::{identity, now, pure, service};

const SECRET: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const EMAIL: &str = "preview@example.com";

fn configured(mut auth: AuthService) -> AuthService {
    auth.preview_sign_in = Some(PreviewSignIn::new(SECRET, EMAIL.to_owned()));
    auth
}

#[test]
fn availability_reflects_validated_configuration() {
    assert!(!pure().preview_sign_in_available());
    assert!(configured(pure()).preview_sign_in_available());
}

#[test]
fn absent_configuration_is_unavailable_before_dependencies_are_used() {
    assert!(matches!(
        pure().preview(SECRET, None, "127.0.0.1"),
        Err(Error::PreviewSignInUnavailable)
    ));
}

#[test]
fn malformed_and_wrong_credentials_commit_their_admission_count() {
    for secret in ["bad".to_owned(), "b".repeat(64)] {
        let queries = Unimock::new((
            RateLimitsMock::rate_limit
                .next_call(matching!(_))
                .returns(Ok(Some(RateLimit {
                    key: "stored".to_owned(),
                    count: 4,
                    resets_at: now() + Duration::seconds(30),
                }))),
            RateLimitsMock::save_rate_limit
                .next_call(matching!((record,) if record.count == 5))
                .returns(Ok(())),
        ));
        let store = Unimock::new(StoreMock::transaction.next_call(matching!(_)).answers_arc(
            Arc::new(move |_, work: &mut dyn Transaction| {
                assert_eq!(work.run(&mut queries.clone())?, Decision::Commit);
                Ok(())
            }),
        ));
        let mut auth = configured(pure());
        auth.store = Arc::new(store);
        auth.runtime = Arc::new(Unimock::new(
            RuntimeMock::now.next_call(matching!()).returns(now()),
        ));
        assert!(matches!(
            auth.preview(&secret, None, "127.0.0.1"),
            Err(Error::InvalidLink)
        ));
    }
}

#[test]
fn exhausted_admission_returns_a_positive_retry_without_verifying() {
    let queries = Unimock::new(
        RateLimitsMock::rate_limit
            .next_call(matching!(_))
            .returns(Ok(Some(RateLimit {
                key: "stored".to_owned(),
                count: 20,
                resets_at: now() + Duration::seconds(19),
            }))),
    );
    let auth = configured(service(
        queries,
        Arc::new(Unimock::new(())),
        Unimock::new(RuntimeMock::now.next_call(matching!()).returns(now())),
    ));
    assert!(matches!(
        auth.preview(SECRET, None, "127.0.0.1"),
        Err(Error::RateLimited(19))
    ));
}

#[test]
fn existing_account_replaces_a_supplied_session() {
    let original = identity();
    let user = original.user.clone();
    let user_id = user.id;
    let queries = Unimock::new((
        RateLimitsMock::rate_limit
            .next_call(matching!((key,) if key == &hash("preview:127.0.0.1")))
            .returns(Ok(None)),
        RateLimitsMock::insert_rate_limit
            .next_call(matching!((record,) if record.count == 1))
            .returns(Ok(())),
        UsersMock::find_user
            .next_call(matching!("preview@example.com"))
            .returns(Ok(Some(user))),
        SessionsMock::delete_session
            .next_call(matching!((token,) if token == &hash("old")))
            .returns(Ok(())),
        SessionsMock::insert_session
            .next_call(matching!((session,) if session.user_id.0 == Uuid::from_u128(7) && session.token_hash == hash("new") && session.csrf_token == "csrf-new"))
            .returns(Ok(())),
    ));
    let runtime = Unimock::new((
        RuntimeMock::now.next_call(matching!()).returns(now()),
        RuntimeMock::secret
            .next_call(matching!())
            .returns(Ok("new".to_owned())),
        RuntimeMock::secret
            .next_call(matching!())
            .returns(Ok("csrf-new".to_owned())),
        RuntimeMock::id
            .next_call(matching!())
            .returns(Uuid::from_u128(8)),
    ));
    let result = configured(service(queries, Arc::new(Unimock::new(())), runtime))
        .preview(SECRET, Some("old"), "127.0.0.1")
        .unwrap();
    assert_eq!(result.credential, "new");
    assert_eq!(result.identity.user.id, user_id);
}

#[test]
fn absent_account_is_created_without_a_previous_session() {
    let queries = Unimock::new((
        RateLimitsMock::rate_limit
            .next_call(matching!(_))
            .returns(Ok(None)),
        RateLimitsMock::insert_rate_limit
            .next_call(matching!(_))
            .returns(Ok(())),
        UsersMock::find_user
            .next_call(matching!("preview@example.com"))
            .returns(Ok(None)),
        UsersMock::insert_user
            .next_call(matching!((user,) if user.id.0 == Uuid::from_u128(9) && user.email == EMAIL && user.name == EMAIL))
            .returns(Ok(())),
        SessionsMock::insert_session
            .next_call(matching!((session,) if session.user_id.0 == Uuid::from_u128(9)))
            .returns(Ok(())),
    ));
    let runtime = Unimock::new((
        RuntimeMock::now.next_call(matching!()).returns(now()),
        RuntimeMock::secret
            .next_call(matching!())
            .returns(Ok("new".to_owned())),
        RuntimeMock::secret
            .next_call(matching!())
            .returns(Ok("csrf-new".to_owned())),
        RuntimeMock::id
            .next_call(matching!())
            .returns(Uuid::from_u128(9)),
    ));
    let result = configured(service(queries, Arc::new(Unimock::new(())), runtime))
        .preview(SECRET, None, "127.0.0.1")
        .unwrap();
    assert_eq!(result.identity.user.email, EMAIL);
}
