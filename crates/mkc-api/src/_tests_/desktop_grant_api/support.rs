//! Real auth policy and in-process routing with deterministic query boundaries.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::Request;
use chrono::{DateTime, Duration, Utc};
use mkc_auth::runtime::{RuntimeMock, hash};
use mkc_auth::service::{AuthService, Identity};
use mkc_config::proxy::TrustedProxies;
use mkc_domain::client_origins::AdmittedOrigins;
use mkc_domain::ids::UserId;
use mkc_store_interface::session::{Session, SessionsMock};
use mkc_store_interface::store::{StoreMock, Transaction};
use mkc_store_interface::user::{User, UsersMock};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::dispatch::ApiDispatcher;
use crate::platform::service::PlatformSessionMock;
use crate::router::{RouterBuilder, RouterFactory};
use crate::views::account::{SessionView, UserView};

pub(super) const APP: &str = "https://app.example.com";
pub(super) const ISSUE: &str = "/v1/auth/desktop/grants";
pub(super) const CALLBACK: &str = "/v1/auth/desktop/callback";
pub(super) const GRANT: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
pub(super) const VERIFIER: &str =
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
pub(super) const CHALLENGE: &str = "_-BU_nrgy23GXDr5th1SCfQ5hR20PQulmXM33xVGaOs";

pub(super) fn now() -> DateTime<Utc> {
    "2026-11-06T12:00:00Z".parse().unwrap()
}

pub(super) fn identity() -> Identity {
    let user_id = UserId(Uuid::from_u128(7));
    Identity {
        user: User {
            id: user_id,
            name: "Person".into(),
            email: "person@example.com".into(),
            created_at: now(),
        },
        session: Session {
            token_hash: hash("old"),
            user_id,
            csrf_token: "csrf".into(),
            created_at: now() - Duration::days(29),
            expires_at: now() + Duration::hours(3),
            last_seen_at: now(),
        },
    }
}

pub(super) fn reads() -> Unimock {
    Unimock::new((
        SessionsMock::session
            .some_call(matching!((key,) if key == &hash("old")))
            .returns(Ok(Some(identity().session))),
        UsersMock::user
            .some_call(matching!((id,) if *id == identity().user.id))
            .returns(Ok(Some(identity().user))),
    ))
}

pub(super) fn router(
    read: Option<Unimock>,
    write: Option<Unimock>,
    issued: bool,
    desktop: bool,
    proxies: TrustedProxies,
) -> Router {
    let origins = AdmittedOrigins::new(APP.into(), desktop);
    let clock_used = read.is_some() || write.is_some();
    let session_issued = issued && read.is_none();
    let read = read.map(|queries| {
        StoreMock::read
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                work.run(&mut queries.clone()).map(|_| ())
            }))
    });
    let write = write.map(|queries| {
        StoreMock::transaction
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                work.run(&mut queries.clone()).map(|_| ())
            }))
    });
    let store = match (read, write) {
        (Some(read), Some(write)) => Unimock::new((read, write)),
        (Some(read), None) => Unimock::new(read),
        (None, Some(write)) => Unimock::new(write),
        (None, None) => Unimock::new(()),
    };
    let clock = RuntimeMock::now.each_call(matching!()).returns(now());
    let runtime = if issued {
        Unimock::new((
            clock,
            RuntimeMock::secret
                .each_call(matching!())
                .answers(&|_| Ok("c".repeat(64))),
        ))
    } else if clock_used {
        Unimock::new(clock)
    } else {
        Unimock::new(())
    };
    let platform = if session_issued {
        Unimock::new(
            PlatformSessionMock
                .some_call(matching!(_))
                .answers(&|_, value| {
                    Ok(SessionView {
                        user: UserView {
                            id: value.user.id,
                            name: value.user.name.clone(),
                            email: value.user.email.clone(),
                            github_connected: false,
                        },
                        csrf_token: value.session.csrf_token.clone(),
                        workspace_ids: Vec::new(),
                    })
                }),
        )
    } else {
        Unimock::new(())
    };
    let auth = AuthService {
        store: Arc::new(store),
        runtime: Arc::new(runtime),
        mailer: Arc::new(Unimock::new(())),
        origins: origins.clone(),
        preview_sign_in: None,
    };
    RouterFactory {
        trusted_proxies: proxies,
        origins,
        billing_configured: false,
        upload: Arc::new(Unimock::new(())),
        live: Arc::new(Unimock::new(())),
        dispatcher: Arc::new(ApiDispatcher {
            auth: Arc::new(auth),
            platform: Arc::new(platform),
            builds: Arc::new(Unimock::new(())),
            health: Arc::new(Unimock::new(())),
            viewer: Arc::new(Unimock::new(())),
            access: Arc::new(Unimock::new(())),
            github: None,
            billing: None,
        }),
    }
    .build()
    .unwrap()
}

pub(super) fn request(
    path: &str,
    body: &str,
    origin: Option<&str>,
    csrf: Option<&str>,
    cookie: bool,
) -> Request<Body> {
    let mut builder = Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", "application/json");
    if let Some(origin) = origin {
        builder = builder.header("origin", origin);
    }
    if let Some(csrf) = csrf {
        builder = builder.header("x-csrf-token", csrf);
    }
    if cookie {
        builder = builder.header("cookie", "mkc_session=old");
    }
    let mut request = builder.body(Body::from(body.to_owned())).unwrap();
    request
        .extensions_mut()
        .insert(ConnectInfo("10.0.0.1:1234".parse::<SocketAddr>().unwrap()));
    request
}
