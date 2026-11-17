//! Deterministic clock and query transaction fixtures backed by unimock.

use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_domain::client_origins::AdmittedOrigins;
use mkc_domain::ids::UserId;
use mkc_email_interface::mail::Mailer;
use mkc_store_interface::session::Session;
use mkc_store_interface::store::{StoreMock, Transaction};
use mkc_store_interface::user::User;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::runtime::{RuntimeMock, hash};
use crate::service::{AuthService, Identity};

pub(super) fn now() -> DateTime<Utc> {
    "2026-09-16T12:00:00Z".parse().unwrap()
}

pub(super) fn identity() -> Identity {
    let user_id = UserId(Uuid::from_u128(7));
    Identity {
        user: User {
            id: user_id,
            email: "person@example.com".to_owned(),
            name: "Person".to_owned(),
            created_at: now(),
        },
        session: Session {
            token_hash: hash("cookie"),
            user_id,
            csrf_token: "csrf".to_owned(),
            created_at: now(),
            expires_at: now() + Duration::days(30),
            last_seen_at: now(),
        },
    }
}

pub(super) fn service(queries: Unimock, mailer: Arc<dyn Mailer>, runtime: Unimock) -> AuthService {
    AuthService {
        store: Arc::new(Unimock::new(
            StoreMock::transaction
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                    work.run(&mut queries.clone()).map(|_| ())
                })),
        )),
        mailer,
        runtime: Arc::new(runtime),
        origins: AdmittedOrigins::new("https://app.example.com".to_owned(), false),
        preview_sign_in: None,
    }
}

pub(super) fn read_service(
    queries: Unimock,
    mailer: Arc<dyn Mailer>,
    runtime: Unimock,
) -> AuthService {
    AuthService {
        store: Arc::new(Unimock::new(
            StoreMock::read
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                    work.run(&mut queries.clone()).map(|_| ())
                })),
        )),
        mailer,
        runtime: Arc::new(runtime),
        origins: AdmittedOrigins::new("https://app.example.com".to_owned(), false),
        preview_sign_in: None,
    }
}

pub(super) fn clock() -> Unimock {
    Unimock::new(RuntimeMock::now.each_call(matching!()).returns(now()))
}

pub(super) fn pure() -> AuthService {
    AuthService {
        store: Arc::new(Unimock::new(())),
        mailer: Arc::new(Unimock::new(())),
        runtime: Arc::new(Unimock::new(())),
        origins: AdmittedOrigins::new("https://app.example.com".to_owned(), false),
        preview_sign_in: None,
    }
}
