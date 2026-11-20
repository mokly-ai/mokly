//! Each link query call site preserves infrastructure failures without relabeling absence.

use std::sync::Arc;

use mkc_domain::client_origins::ClientOrigin;

use chrono::Duration;
use mkc_store_interface::magic_link::{MagicLink, MagicLinksMock};
use mkc_store_interface::rate_limit::{RateLimit, RateLimitsMock};
use mkc_store_interface::session::SessionsMock;
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};

use crate::service::Authenticator;

use super::failure_fixture::{Site, assert_internal, fail, runtime};
use super::support::{now, service};

fn issue_fails(site: Site, context: &str) {
    let queries = Unimock::new((
        RateLimitsMock::rate_limit
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, key: &str| {
                fail(Site::RateLimit, site)?;
                Ok((site == Site::SaveRateLimit).then(|| RateLimit {
                    key: key.to_owned(),
                    count: 0,
                    resets_at: now() + Duration::minutes(1),
                }))
            })),
        RateLimitsMock::insert_rate_limit
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| fail(Site::InsertRateLimit, site))),
        RateLimitsMock::save_rate_limit
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| fail(Site::SaveRateLimit, site))),
        MagicLinksMock::insert_magic_link
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| fail(Site::InsertLink, site))),
    ))
    .no_verify_in_drop();
    let error = service(queries, Arc::new(Unimock::new(())), runtime())
        .issue("person@example.com", None, "127.0.0.1", ClientOrigin::App)
        .err()
        .unwrap();
    assert_internal(error, context);
}

fn verify_fails(site: Site, context: &str) {
    let queries = Unimock::new((
        MagicLinksMock::magic_link
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, hash: &str| {
                fail(Site::Link, site)?;
                Ok(Some(MagicLink {
                    token_hash: hash.to_owned(),
                    email: "person@example.com".into(),
                    return_to: "/dashboard".into(),
                    expires_at: now() + Duration::minutes(15),
                    used_at: None,
                }))
            })),
        UsersMock::find_user
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                fail(Site::FindUser, site)?;
                Ok(None)
            })),
        UsersMock::insert_user
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| fail(Site::InsertUser, site))),
        MagicLinksMock::save_magic_link
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| fail(Site::SaveLink, site))),
        SessionsMock::delete_session
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| fail(Site::DeleteSession, site))),
        SessionsMock::insert_session
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| fail(Site::InsertSession, site))),
    ))
    .no_verify_in_drop();
    let error = service(queries, Arc::new(Unimock::new(())), runtime())
        .verify(&"a".repeat(64), Some("previous"))
        .err()
        .unwrap();
    assert_internal(error, context);
}

#[test]
fn admission_lookup_failure_is_internal() {
    issue_fails(Site::RateLimit, "rate limit query");
}
#[test]
fn admission_insert_failure_is_internal() {
    issue_fails(Site::InsertRateLimit, "insert rate limit query");
}
#[test]
fn admission_update_failure_is_internal() {
    issue_fails(Site::SaveRateLimit, "save rate limit query");
}
#[test]
fn link_insert_failure_is_internal() {
    issue_fails(Site::InsertLink, "insert magic link query");
}
#[test]
fn link_lookup_failure_is_internal() {
    verify_fails(Site::Link, "magic link query");
}
#[test]
fn account_lookup_failure_is_internal() {
    verify_fails(Site::FindUser, "find user query");
}
#[test]
fn account_insert_failure_is_internal() {
    verify_fails(Site::InsertUser, "insert user query");
}
#[test]
fn link_consumption_failure_is_internal() {
    verify_fails(Site::SaveLink, "save magic link query");
}
#[test]
fn previous_session_deletion_failure_is_internal() {
    verify_fails(Site::DeleteSession, "delete session query");
}
#[test]
fn issued_session_insertion_failure_is_internal() {
    verify_fails(Site::InsertSession, "insert session query");
}
