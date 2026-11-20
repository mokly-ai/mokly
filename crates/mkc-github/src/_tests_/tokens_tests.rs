//! Installation credential cache boundaries, expiry and 401 recovery.

use std::sync::Arc;

use chrono::Duration;
use mkc_github_interface::credentials::{
    AppJwtMock, ClockMock, InstallationToken, Secret, TokenCacheMock, TokenIssuer, TokenIssuerMock,
    TokensMock,
};
use mkc_github_interface::error::Error;
use mkc_github_interface::http::Method;
use mkc_github_interface::repositories::Repositories;
use unimock::{MockFn, Unimock, matching};

use crate::tokens::{CachedTokensFactory, InstallationTokenIssuer, TokensFactory};

use super::fixtures::{api, client, now, recorded, response};

fn token(seconds: i64) -> InstallationToken {
    InstallationToken {
        token: Secret::new("cached".into()),
        expires_at: now() + Duration::seconds(seconds),
    }
}

#[test]
fn cache_hit_does_not_contact_the_issuer() {
    let cache = Unimock::new(
        TokenCacheMock::get
            .some_call(matching!(1))
            .returns(Ok(Some(token(61)))),
    );
    let tokens = CachedTokensFactory.build(
        Arc::new(cache),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            ClockMock::now.some_call(matching!()).returns(now()),
        )),
    );
    assert_eq!(tokens.get(1).unwrap().expose(), "cached");
}

#[test]
fn boundary_expiry_refreshes_and_persists_before_returning() {
    let cache = Unimock::new((
        TokenCacheMock::get
            .some_call(matching!(1))
            .returns(Ok(Some(token(60)))),
        TokenCacheMock::put
            .some_call(matching!(1, _))
            .answers(&|_, _, value| {
                assert_eq!(value.expires_at, now() + Duration::hours(1));
                Ok(())
            }),
    ));
    let tokens = CachedTokensFactory.build(
        Arc::new(cache),
        Arc::new(Unimock::new(
            TokenIssuerMock::issue
                .some_call(matching!(1))
                .returns(Ok(token(3600))),
        )),
        Arc::new(Unimock::new(
            ClockMock::now.each_call(matching!()).returns(now()),
        )),
    );
    assert_eq!(tokens.get(1).unwrap().expose(), "cached");
}

#[test]
fn failed_issuance_never_writes_the_cache() {
    let cache = Unimock::new(
        TokenCacheMock::get
            .some_call(matching!(1))
            .returns(Ok(None)),
    );
    let tokens = CachedTokensFactory.build(
        Arc::new(cache),
        Arc::new(Unimock::new(
            TokenIssuerMock::issue
                .some_call(matching!(1))
                .returns(Err(Error::Forbidden)),
        )),
        Arc::new(Unimock::new(())),
    );
    assert!(matches!(tokens.get(1), Err(Error::Forbidden)));
}

#[test]
fn an_already_expired_provider_token_is_unavailable_and_never_cached() {
    let tokens = CachedTokensFactory.build(
        Arc::new(Unimock::new(
            TokenCacheMock::get
                .some_call(matching!(1))
                .returns(Ok(None)),
        )),
        Arc::new(Unimock::new(
            TokenIssuerMock::issue
                .some_call(matching!(1))
                .returns(Ok(token(0))),
        )),
        Arc::new(Unimock::new(
            ClockMock::now.some_call(matching!()).returns(now()),
        )),
    );
    assert!(matches!(tokens.get(1), Err(Error::Unavailable)));
}

#[test]
fn invalidation_reaches_the_cache() {
    let tokens = CachedTokensFactory.build(
        Arc::new(Unimock::new(
            TokenCacheMock::invalidate
                .some_call(matching!(1))
                .returns(Ok(())),
        )),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
    );
    tokens.invalidate(1).unwrap();
}

#[test]
fn token_issue_uses_app_jwt_and_provider_expiry() {
    let issuer: &dyn TokenIssuer = &InstallationTokenIssuer {
        jwt: Arc::new(Unimock::new(
            AppJwtMock::issue
                .some_call(matching!())
                .returns(Ok(Secret::new("app-jwt".into()))),
        )),
        http: Arc::new(recorded(vec![(
            Method::Post,
            api("/app/installations/1/access_tokens"),
            response("installation-token"),
        )])),
    };
    let token = issuer.issue(1).unwrap();
    assert_eq!(token.expires_at, now() + Duration::hours(1));
    assert_eq!(token.token.expose(), "ghs_sanitized_installation_fixture");
}

#[test]
fn a_provider_401_invalidates_and_refreshes_exactly_once() {
    let mut github = client(recorded(vec![
        (
            Method::Get,
            api("/installation/repositories?per_page=100&page=1"),
            response("unauthorized"),
        ),
        (
            Method::Get,
            api("/installation/repositories?per_page=100&page=1"),
            response("repositories"),
        ),
    ]));
    github.tokens = Arc::new(Unimock::new((
        TokensMock::get
            .next_call(matching!(1))
            .returns(Ok(Secret::new("old".into()))),
        TokensMock::invalidate
            .next_call(matching!(1))
            .returns(Ok(())),
        TokensMock::get
            .next_call(matching!(1))
            .returns(Ok(Secret::new("new".into()))),
    )));
    assert_eq!(Repositories::repositories(&github, 1).unwrap().len(), 1);
}
