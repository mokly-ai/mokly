//! Injectable provider composition for deployments and recorded HTTP integration tests.

use std::sync::Arc;

use mkc_config::github::GitHubSettings;
use mkc_domain::app_paths;
use mkc_github::client::{GitHub, OAuthSettings};
use mkc_github::runtime::{SystemClock, ThreadSleeper};
use mkc_github::security::HmacVerifier;
use mkc_github::signing::{RsaSignerFactory, SignerFactory};
use mkc_github::tokens::{
    CachedTokensFactory, InstallationTokenIssuer, MemoryTokenCache, TokensFactory,
};
use mkc_github::transport::{HttpFactory, ReqwestFactory, RetryingHttp};
use mkc_github_interface::checks::Checks;
use mkc_github_interface::credentials::{Clock, Secret, Tokens};
use mkc_github_interface::http::Http;
use mkc_github_interface::identity::Identities;
use mkc_github_interface::pull_requests::PullRequests;
use mkc_github_interface::repositories::Repositories;
use mkc_github_interface::webhooks::WebhookVerifier;

use crate::error::Result;

/// Build the one registered user-authorization callback URI used at both
/// GitHub authorization and token exchange boundaries.
pub(crate) fn github_callback_uri(app_origin: &str) -> String {
    app_paths::on_origin(app_origin, app_paths::GITHUB_CALLBACK)
}

/// Provider behavior available to account, webhook and publication services.
pub struct GitHubProviders {
    /// User authentication and administration proofs.
    pub identities: Arc<dyn Identities>,
    /// Installation/repository reconciliation.
    pub repositories: Arc<dyn Repositories>,
    /// Current PR metadata and provider review/comment operations.
    pub pull_requests: Arc<dyn PullRequests>,
    /// Check-run transport for publication and build check delivery.
    pub checks: Arc<dyn Checks>,
    /// Shared cached installation credentials.
    pub tokens: Arc<dyn Tokens>,
    /// Raw-body HMAC verification.
    pub verifier: Arc<dyn WebhookVerifier>,
}

/// Provider construction can be replaced with recorded transport in integration tests.
pub trait GitHubProviderFactory: Send + Sync {
    /// Create authenticated clients for a registered App.
    fn create(&self, settings: &GitHubSettings, app_origin: &str) -> Result<GitHubProviders>;
}

/// Production factory; the configured origins are GitHub's own unless a
/// development deployment points them at the recorded double.
pub struct SystemGitHubProviderFactory;

impl GitHubProviderFactory for SystemGitHubProviderFactory {
    fn create(&self, settings: &GitHubSettings, app_origin: &str) -> Result<GitHubProviders> {
        let clock: Arc<dyn Clock> = Arc::new(SystemClock);
        let http: Arc<dyn Http> = Arc::new(RetryingHttp {
            http: ReqwestFactory.build(&settings.api_origin, &settings.web_origin)?,
            clock: clock.clone(),
            sleeper: Arc::new(ThreadSleeper),
        });
        let jwt = RsaSignerFactory.build(
            settings.client_id.clone(),
            &settings.private_key,
            clock.clone(),
        )?;
        let tokens = CachedTokensFactory.build(
            Arc::new(MemoryTokenCache::default()),
            Arc::new(InstallationTokenIssuer {
                jwt: jwt.clone(),
                http: http.clone(),
            }),
            clock,
        );
        let github = Arc::new(GitHub {
            http,
            tokens: tokens.clone(),
            jwt,
            oauth: OAuthSettings {
                client_id: settings.client_id.clone(),
                client_secret: Secret::new(settings.client_secret.clone()),
                redirect_uri: github_callback_uri(app_origin),
            },
        });
        Ok(GitHubProviders {
            identities: github.clone(),
            repositories: github.clone(),
            pull_requests: github.clone(),
            checks: github,
            tokens,
            verifier: Arc::new(HmacVerifier {
                secret: Secret::new(settings.webhook_secret.clone()),
            }),
        })
    }
}
