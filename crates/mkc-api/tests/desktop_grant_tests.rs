//! Real auth and Postgres exchange keep a wrong verifier harmless and give one winner.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::{Arc, Barrier};
use std::thread;

use chrono::{DateTime, Duration, Utc};
use mkc_auth::error::Error;
use mkc_auth::runtime::{RuntimeMock, hash};
use mkc_auth::service::{AuthService, Authenticator};
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_domain::client_origins::AdmittedOrigins;
use mkc_store_interface::session::Session;
use mkc_store_interface::store::{Callback, Store};
use mkc_store_interface::user::User;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use mkc_test_pg::scratch_schema::ScratchSchema;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

fn service(store: Arc<dyn Store>, secret: char, now: DateTime<Utc>) -> AuthService {
    AuthService {
        store,
        runtime: Arc::new(Unimock::new((
            RuntimeMock::now.each_call(matching!()).returns(now),
            RuntimeMock::secret
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| Ok(secret.to_string().repeat(64)))),
        ))),
        mailer: Arc::new(Unimock::new(())),
        origins: AdmittedOrigins::new("https://app.example.com".into(), true),
        preview_sign_in: None,
    }
}

#[test]
fn desktop_grant_wrong_verifier_preserves_the_grant_and_concurrent_exchange_has_one_winner() {
    let Some(schema) = ScratchSchema::create("desktop_exchange") else {
        return;
    };
    DieselMigrations.migrate(schema.scoped_url()).unwrap();
    let store = PgStoreFactory {
        runtime: Arc::new(SystemRuntime),
    }
    .connect(schema.scoped_url())
    .unwrap();
    let now: DateTime<Utc> = "2026-11-06T12:00:00Z".parse().unwrap();
    let deadline = now + Duration::hours(3);
    let user = User {
        id: Uuid::from_u128(7).into(),
        email: "browser@example.com".into(),
        name: "Browser".into(),
        created_at: now,
    };
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_user(&user)?;
            for credential in ["browser", "previous"] {
                queries.insert_session(&Session {
                    token_hash: hash(credential),
                    user_id: user.id,
                    csrf_token: "csrf".into(),
                    created_at: now - Duration::days(29),
                    last_seen_at: now,
                    expires_at: deadline,
                })?;
            }
            Ok(())
        }))
        .unwrap();
    let issuer = service(store.clone(), 'b', now);
    let browser = issuer.authenticate("browser").unwrap();
    let issued = issuer
        .issue_desktop_grant(
            &browser,
            "_-BU_nrgy23GXDr5th1SCfQ5hR20PQulmXM33xVGaOs",
            Some("/acme/project?branch=topic%2Fwork"),
            "127.0.0.1",
        )
        .unwrap();
    assert_eq!(issued.expires_at, now + Duration::minutes(5));
    issuer.sign_out("browser").unwrap();

    let wrong = service(store.clone(), 'e', now + Duration::minutes(1));
    assert!(matches!(
        wrong.exchange_desktop_grant(
            &issued.grant,
            &"c".repeat(64),
            Some("previous"),
            "127.0.0.1"
        ),
        Err(Error::InvalidDesktopGrant)
    ));
    store
        .transaction(&mut Callback(&mut |queries| {
            let grant = queries.desktop_grant(&hash(&issued.grant))?.unwrap();
            assert_eq!(grant.used_at, None);
            assert_eq!(grant.session_expires_at, deadline);
            assert!(queries.session(&hash("previous"))?.is_some());
            Ok(())
        }))
        .unwrap();

    let start = Arc::new(Barrier::new(2));
    let workers: Vec<_> = ['c', 'd']
        .into_iter()
        .map(|secret| {
            let store = store.clone();
            let start = start.clone();
            let grant = issued.grant.clone();
            thread::spawn(move || {
                let auth = service(store, secret, now + Duration::minutes(2));
                start.wait();
                auth.exchange_desktop_grant(&grant, &"a".repeat(64), Some("previous"), "127.0.0.1")
            })
        })
        .collect();
    let results: Vec<_> = workers
        .into_iter()
        .map(|worker| worker.join().unwrap())
        .collect();
    assert_eq!(results.iter().filter(|value| value.is_ok()).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|value| matches!(value, Err(Error::InvalidDesktopGrant)))
            .count(),
        1
    );
    let winner = results.into_iter().find_map(Result::ok).unwrap();
    assert_eq!(winner.session.identity.session.expires_at, deadline);
    assert_eq!(
        winner.session.identity.session.created_at,
        now + Duration::minutes(2)
    );
    assert_eq!(winner.return_to, "/acme/project?branch=topic%2Fwork");
    assert_eq!(winner.session.identity.user.id, user.id);
    store
        .transaction(&mut Callback(&mut |queries| {
            assert!(queries.session(&hash("previous"))?.is_none());
            assert!(queries.session(&hash("browser"))?.is_none());
            assert_eq!(
                queries
                    .session(&hash(&winner.session.credential))?
                    .unwrap()
                    .expires_at,
                deadline
            );
            assert_eq!(
                queries
                    .desktop_grant(&hash(&issued.grant))?
                    .unwrap()
                    .used_at,
                Some(now + Duration::minutes(2))
            );
            Ok(())
        }))
        .unwrap();
}
