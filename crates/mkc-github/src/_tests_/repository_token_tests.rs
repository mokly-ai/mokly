//! Scoped installation credentials never share the ordinary token cache.

use std::sync::Arc;

use chrono::Duration;
use mkc_github_interface::credentials::{
    ClockMock, InstallationToken, Secret, TokenIssuer, TokenIssuerMock,
};
use mkc_github_interface::error::Error;
use mkc_github_interface::http::{HttpMock, Method};
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::tokens::{CachedTokensFactory, InstallationTokenIssuer, TokensFactory};

use super::fixtures::{api, app_jwt, now, response};

#[test]
fn scoped_mint_uses_app_jwt_one_repository_and_only_contents_read() {
    let issuer: &dyn TokenIssuer = &InstallationTokenIssuer {
        jwt: app_jwt(),
        http: Arc::new(Unimock::new(
            HttpMock::send
                .some_call(matching!(_))
                .answers(&|_, request| {
                    assert_eq!(request.method, Method::Post);
                    assert_eq!(request.endpoint, api("/app/installations/1/access_tokens"));
                    assert_eq!(request.bearer.as_ref().unwrap().expose(), "app-jwt");
                    let body: serde_json::Value =
                        serde_json::from_str(request.body.as_ref().unwrap()).unwrap();
                    assert_eq!(
                        body,
                        json!({"repository_ids":[100],"permissions":{"contents":"read"}})
                    );
                    Ok(response("repository-token"))
                }),
        )),
    };
    assert_eq!(
        issuer.issue_repository(1, 100).unwrap().token.expose(),
        "ghs_sanitized_installation_fixture"
    );
}

#[test]
fn invalid_scope_never_signs_or_contacts_provider() {
    let issuer: &dyn TokenIssuer = &InstallationTokenIssuer {
        jwt: Arc::new(Unimock::new(())),
        http: Arc::new(Unimock::new(())),
    };
    for (installation, repository) in [(0, 100), (1, 0), (-1, 100)] {
        assert!(matches!(
            issuer.issue_repository(installation, repository),
            Err(Error::InvalidRequest)
        ));
    }
}

#[test]
fn every_attempt_mints_without_cache_reads_writes_or_refresh_lock() {
    let tokens = CachedTokensFactory.build(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            TokenIssuerMock::issue_repository
                .each_call(matching!(1, 100))
                .answers(&|_, _, _| {
                    Ok(InstallationToken {
                        token: Secret::new("attempt-token".into()),
                        expires_at: now() + Duration::hours(1),
                    })
                })
                .n_times(2),
        )),
        Arc::new(Unimock::new(
            ClockMock::now.each_call(matching!()).returns(now()),
        )),
    );
    assert_eq!(
        tokens.repository_read(1, 100).unwrap().expose(),
        "attempt-token"
    );
    assert_eq!(
        tokens.repository_read(1, 100).unwrap().expose(),
        "attempt-token"
    );
}

#[test]
fn mint_preserves_access_refusals_and_rejects_stale_credentials() {
    let tokens = CachedTokensFactory.build(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            TokenIssuerMock::issue_repository
                .some_call(matching!(1, 100))
                .returns(Err(Error::Forbidden)),
        )),
        Arc::new(Unimock::new(())),
    );
    assert!(matches!(
        tokens.repository_read(1, 100),
        Err(Error::Forbidden)
    ));
    let tokens = CachedTokensFactory.build(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            TokenIssuerMock::issue_repository
                .some_call(matching!(1, 100))
                .returns(Ok(InstallationToken {
                    token: Secret::new("old".into()),
                    expires_at: now() + Duration::seconds(60),
                })),
        )),
        Arc::new(Unimock::new(
            ClockMock::now.some_call(matching!()).returns(now()),
        )),
    );
    assert!(matches!(
        tokens.repository_read(1, 100),
        Err(Error::Unavailable)
    ));
}
