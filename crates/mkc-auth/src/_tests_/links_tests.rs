//! Admission, email-existence privacy and one-use verification through mocks.

use std::sync::Arc;

use mkc_domain::client_origins::ClientOrigin;

use chrono::Duration;
use mkc_email_interface::mail::{Content, Lifetime, MailerMock};
use mkc_store_interface::magic_link::{MagicLink, MagicLinksMock};
use mkc_store_interface::rate_limit::{RateLimit, RateLimitsMock};
use mkc_store_interface::session::SessionsMock;
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::Error;
use crate::runtime::{RuntimeMock, hash};
use crate::service::Authenticator;

use super::failure_fixture::runtime;
use super::support::{identity, now, pure, service};

const RETURN_TO: &str = "/mokly/cloud?selection=one%26two&tag=alpha%2Bbeta&note=release%23one&branch=équipe/東京&view=changes&view=browse";

#[test]
fn issue_stores_only_hash_and_defaults_a_rejected_return_destination() {
    let secret = "a".repeat(64);
    let query = Unimock::new((
        RateLimitsMock::rate_limit.each_call(matching!(_)).answers(&|_, _| Ok(None)),
        RateLimitsMock::insert_rate_limit.each_call(matching!(_)).answers(&|_, _| Ok(())),
        MagicLinksMock::insert_magic_link.next_call(matching!((link,) if link.token_hash == hash(&"a".repeat(64)) && link.return_to == "/dashboard" && link.email == "person@example.com")).returns(Ok(())),
    ));
    let mail = Arc::new(Unimock::new(
        MailerMock::send
            .next_call(matching!((m,) if m.recipient == "person@example.com" && m.content.link() == format!("https://app.example.com/auth/email/callback#token={}", "a".repeat(64)) && matches!(&m.content, Content::SignIn { valid_for: Lifetime::Minutes(15), .. })))
            .returns(Ok(())),
    ));
    let runtime = Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now()),
        RuntimeMock::id
            .each_call(matching!())
            .returns(Uuid::from_u128(8)),
        RuntimeMock::secret
            .next_call(matching!())
            .returns(Ok(secret)),
    ));
    let result = service(query, mail, runtime)
        .issue(
            " Person@Example.com ",
            Some("//evil.test"),
            "127.0.0.1",
            ClientOrigin::App,
        )
        .unwrap();
    assert_eq!(result.resend_after, now() + Duration::seconds(60));
}

#[test]
fn limited_email_does_not_send_or_inspect_users() {
    let query = Unimock::new(
        RateLimitsMock::rate_limit
            .next_call(matching!(_))
            .returns(Ok(Some(RateLimit {
                key: "key".to_owned(),
                count: 1,
                resets_at: now() + Duration::seconds(20),
            }))),
    );
    let runtime = Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now()),
        RuntimeMock::id
            .each_call(matching!())
            .returns(Uuid::from_u128(8)),
        RuntimeMock::secret
            .next_call(matching!())
            .returns(Ok("a".repeat(64))),
    ));
    let auth = service(query, Arc::new(Unimock::new(())), runtime);
    assert!(matches!(
        auth.issue("person@example.com", None, "127.0.0.1", ClientOrigin::App),
        Err(Error::RateLimited(20))
    ));
}

#[test]
fn existing_user_exchange_consumes_link_and_replaces_session() {
    let identity = identity();
    let query = Unimock::new((
        MagicLinksMock::magic_link
            .next_call(matching!(_))
            .returns(Ok(Some(MagicLink {
                token_hash: hash(&"a".repeat(64)),
                email: identity.user.email.clone(),
                return_to: RETURN_TO.to_owned(),
                expires_at: now() + Duration::minutes(15),
                used_at: None,
            }))),
        UsersMock::find_user
            .next_call(matching!(_))
            .returns(Ok(Some(identity.user))),
        MagicLinksMock::save_magic_link
            .next_call(matching!((link,) if link.used_at == Some(now())))
            .returns(Ok(())),
        SessionsMock::delete_session
            .next_call(matching!((h,) if h == &hash("old")))
            .returns(Ok(())),
        SessionsMock::insert_session
            .next_call(matching!((s,) if s.token_hash == hash("new") && s.csrf_token == "csrf-new"))
            .returns(Ok(())),
    ));
    let runtime = Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now()),
        RuntimeMock::id
            .each_call(matching!())
            .returns(Uuid::from_u128(8)),
        RuntimeMock::secret
            .next_call(matching!())
            .returns(Ok("new".to_owned())),
        RuntimeMock::secret
            .next_call(matching!())
            .returns(Ok("csrf-new".to_owned())),
    ));
    let auth = service(query, Arc::new(Unimock::new(())), runtime);
    let result = auth.verify(&"a".repeat(64), Some("old")).unwrap();
    assert_eq!(result.session.credential, "new");
    assert_eq!(result.return_to, RETURN_TO);
}

#[test]
fn malformed_token_fails_before_any_dependency() {
    let auth = pure();
    assert!(matches!(auth.verify("bad", None), Err(Error::InvalidLink)));
}

#[test]
fn unknown_expired_and_consumed_links_have_distinct_reasons() {
    for state in 0..3 {
        let link = (state != 0).then(|| MagicLink {
            token_hash: hash(&"a".repeat(64)),
            email: "person@example.com".to_owned(),
            return_to: "/dashboard".to_owned(),
            expires_at: now(),
            used_at: (state == 2).then(now),
        });
        let query = Unimock::new(
            MagicLinksMock::magic_link
                .next_call(matching!(_))
                .returns(Ok(link)),
        );
        let runtime = Unimock::new((
            RuntimeMock::now.each_call(matching!()).returns(now()),
            RuntimeMock::id
                .each_call(matching!())
                .returns(Uuid::from_u128(8)),
            RuntimeMock::secret
                .each_call(matching!())
                .answers(&|_| Ok("a".repeat(64))),
        ));
        let auth = service(query, Arc::new(Unimock::new(())), runtime);
        let result = auth.verify(&"a".repeat(64), None);
        match state {
            0 => assert!(matches!(result, Err(Error::InvalidLink))),
            1 => assert!(matches!(result, Err(Error::LinkExpired))),
            _ => assert!(matches!(result, Err(Error::LinkUsed))),
        }
    }
}

#[test]
fn absent_account_creates_a_verified_user_and_binds_the_session() {
    let query = Unimock::new((
        MagicLinksMock::magic_link
            .next_call(matching!(_))
            .returns(Ok(Some(MagicLink {
                token_hash: hash(&"a".repeat(64)),
                email: "person@example.com".into(),
                return_to: "/dashboard".into(),
                expires_at: now() + Duration::minutes(15),
                used_at: None,
            }))),
        UsersMock::find_user
            .next_call(matching!("person@example.com"))
            .returns(Ok(None)),
        UsersMock::insert_user
            .next_call(
                matching!((u,) if u.id.0 == Uuid::from_u128(8) && u.email == "person@example.com"),
            )
            .returns(Ok(())),
        MagicLinksMock::save_magic_link
            .next_call(matching!((link,) if link.used_at == Some(now())))
            .returns(Ok(())),
        SessionsMock::insert_session
            .next_call(matching!((s,) if s.user_id.0 == Uuid::from_u128(8)))
            .returns(Ok(())),
    ));
    let auth = service(query, Arc::new(Unimock::new(())), runtime());
    assert_eq!(
        auth.verify(&"a".repeat(64), None)
            .unwrap()
            .session
            .identity
            .user
            .id
            .0,
        Uuid::from_u128(8)
    );
}
