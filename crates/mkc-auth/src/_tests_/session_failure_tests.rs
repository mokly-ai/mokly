//! Session absence and failures are classified at each actual lookup or mutation.

use std::sync::Arc;

use chrono::Duration;
use mkc_store_interface::session::SessionsMock;
use mkc_store_interface::store::{StoreMock, Transaction};
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::service::Authenticator;

use super::failure_fixture::{Site, assert_internal, fail, failure, runtime};
use super::support::{clock, identity, now, pure, read_service, service};

fn resolve_fails(site: Site, context: &str) {
    let queries = Unimock::new((
        SessionsMock::session
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                fail(Site::Session, site)?;
                Ok(Some(identity().session))
            })),
        UsersMock::user
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                fail(Site::User, site)?;
                Ok(Some(identity().user))
            })),
    ))
    .no_verify_in_drop();
    let error = read_service(queries, Arc::new(Unimock::new(())), clock())
        .authenticate("cookie")
        .err()
        .unwrap();
    assert_internal(error, context);
}

fn rotate_fails(site: Site, context: &str) {
    let queries = Unimock::new((
        SessionsMock::session
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Some(identity().session))),
        UsersMock::user
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Some(identity().user))),
        SessionsMock::delete_session
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| fail(Site::DeleteSession, site))),
        SessionsMock::insert_session
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| fail(Site::InsertSession, site))),
    ))
    .no_verify_in_drop();
    let error = service(queries, Arc::new(Unimock::new(())), runtime())
        .rotate("cookie")
        .err()
        .unwrap();
    assert_internal(error, context);
}

#[test]
fn missing_session_is_unauthenticated() {
    let queries = Unimock::new(
        SessionsMock::session
            .next_call(matching!(_))
            .returns(Ok(None)),
    );
    let auth = read_service(queries, Arc::new(Unimock::new(())), clock());
    assert!(matches!(
        auth.authenticate("cookie"),
        Err(Error::Unauthenticated)
    ));
}

#[test]
fn missing_session_user_is_unauthenticated() {
    let queries = Unimock::new((
        SessionsMock::session
            .next_call(matching!(_))
            .returns(Ok(Some(identity().session))),
        UsersMock::user.next_call(matching!(_)).returns(Ok(None)),
    ));
    let auth = read_service(queries, Arc::new(Unimock::new(())), clock());
    assert!(matches!(
        auth.authenticate("cookie"),
        Err(Error::Unauthenticated)
    ));
}

#[test]
fn session_lookup_failure_is_internal() {
    resolve_fails(Site::Session, "session query");
}
#[test]
fn session_user_failure_is_internal() {
    resolve_fails(Site::User, "user query");
}
#[test]
fn rotation_deletion_failure_is_internal() {
    rotate_fails(Site::DeleteSession, "delete session query");
}
#[test]
fn rotation_insertion_failure_is_internal() {
    rotate_fails(Site::InsertSession, "insert session query");
}
#[test]
fn sign_out_deletion_failure_is_internal() {
    let queries = Unimock::new(
        SessionsMock::delete_session
            .next_call(matching!(_))
            .returns(fail(Site::DeleteSession, Site::DeleteSession)),
    );
    let error = service(queries, Arc::new(Unimock::new(())), Unimock::new(()))
        .sign_out("cookie")
        .err()
        .unwrap();
    assert_internal(error, "delete session query");
}

#[test]
fn touch_query_failure_is_internal_at_the_autocommit_call_site() {
    let mut session = identity().session;
    session.last_seen_at = now() - Duration::minutes(6);
    let reads = Unimock::new((
        SessionsMock::session
            .next_call(matching!(_))
            .returns(Ok(Some(session))),
        UsersMock::user
            .next_call(matching!(_))
            .returns(Ok(Some(identity().user))),
    ));
    let touch = Unimock::new(
        SessionsMock::touch
            .next_call(matching!(_, _, _))
            .returns(Err(failure())),
    );
    let mut auth = pure();
    auth.runtime = Arc::new(clock());
    auth.store = Arc::new(Unimock::new((
        StoreMock::read
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                work.run(&mut reads.clone()).map(|_| ())
            }))
            .once(),
        StoreMock::autocommit
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                work.run(&mut touch.clone()).map(|_| ())
            }))
            .once(),
    )));
    assert_internal(
        auth.authenticate("cookie").unwrap_err(),
        "touch session activity",
    );
}
