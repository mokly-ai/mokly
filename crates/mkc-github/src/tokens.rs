//! Installation token issue, expiry and serialized cache refresh.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use chrono::Duration;
use mkc_github_interface::credentials::{
    AppJwt, Clock, InstallationToken, Secret, TokenCache, TokenIssuer, Tokens,
};
use mkc_github_interface::error::{Error, Result};
use mkc_github_interface::http::{Endpoint, Http, Method, Request};
use serde::Serialize;

use crate::client::json;
use crate::response;

#[derive(Debug, thiserror::Error)]
enum CacheError {
    #[error("[mkc-github/tokens] token cache lock poisoned")]
    Poisoned,
}

/// Process-local token storage; cached secrets never enter Postgres.
#[derive(Default)]
pub struct MemoryTokenCache {
    entries: Mutex<HashMap<i64, InstallationToken>>,
}

impl TokenCache for MemoryTokenCache {
    fn get(&self, installation: i64) -> Result<Option<InstallationToken>> {
        match self.entries.lock() {
            Ok(entries) => Ok(entries.get(&installation).cloned()),
            Err(_) => Err(Error::internal(CacheError::Poisoned)),
        }
    }

    fn put(&self, installation: i64, token: InstallationToken) -> Result<()> {
        match self.entries.lock() {
            Ok(mut entries) => {
                entries.insert(installation, token);
                Ok(())
            }
            Err(_) => Err(Error::internal(CacheError::Poisoned)),
        }
    }

    fn invalidate(&self, installation: i64) -> Result<()> {
        match self.entries.lock() {
            Ok(mut entries) => {
                entries.remove(&installation);
                Ok(())
            }
            Err(_) => Err(Error::internal(CacheError::Poisoned)),
        }
    }
}

/// App-authenticated installation token issuer.
pub struct InstallationTokenIssuer {
    /// App signing behavior.
    pub jwt: Arc<dyn AppJwt>,
    /// Provider HTTP boundary.
    pub http: Arc<dyn Http>,
}

impl TokenIssuer for InstallationTokenIssuer {
    fn issue(&self, installation: i64) -> Result<InstallationToken> {
        if installation <= 0 {
            return Err(Error::InvalidRequest);
        }
        response::decode(self.http.send(&Request {
            method: Method::Post,
            endpoint: Endpoint::Api(format!("/app/installations/{installation}/access_tokens")),
            bearer: Some(self.jwt.issue()?),
            body: Some("{}".to_owned()),
        })?)
    }

    fn issue_repository(&self, installation: i64, repository: i64) -> Result<InstallationToken> {
        if installation <= 0 || repository <= 0 {
            return Err(Error::InvalidRequest);
        }
        response::decode(self.http.send(&Request {
            method: Method::Post,
            endpoint: Endpoint::Api(format!("/app/installations/{installation}/access_tokens")),
            bearer: Some(self.jwt.issue()?),
            body: json(&RepositoryScope {
                repository_ids: [repository],
                permissions: ContentsRead { contents: "read" },
            })?,
        })?)
    }
}

#[derive(Serialize)]
struct RepositoryScope {
    repository_ids: [i64; 1],
    permissions: ContentsRead,
}

#[derive(Serialize)]
struct ContentsRead {
    contents: &'static str,
}

/// Constructs a shared token manager with one refresh serialization boundary.
pub trait TokensFactory {
    /// Build a manager from cache storage, token issuer and clock.
    fn build(
        &self,
        cache: Arc<dyn TokenCache>,
        issuer: Arc<dyn TokenIssuer>,
        clock: Arc<dyn Clock>,
    ) -> Arc<dyn Tokens>;
}

/// Composition root for expiry-aware installation token behavior.
pub struct CachedTokensFactory;

struct CachedTokens {
    cache: Arc<dyn TokenCache>,
    issuer: Arc<dyn TokenIssuer>,
    clock: Arc<dyn Clock>,
    refresh: Mutex<()>,
}

impl TokensFactory for CachedTokensFactory {
    fn build(
        &self,
        cache: Arc<dyn TokenCache>,
        issuer: Arc<dyn TokenIssuer>,
        clock: Arc<dyn Clock>,
    ) -> Arc<dyn Tokens> {
        Arc::new(CachedTokens {
            cache,
            issuer,
            clock,
            refresh: Mutex::new(()),
        })
    }
}

impl Tokens for CachedTokens {
    fn repository_read(&self, installation: i64, repository: i64) -> Result<Secret> {
        let token = self.issuer.issue_repository(installation, repository)?;
        if token.token.expose().is_empty()
            || token.expires_at <= self.clock.now() + Duration::seconds(60)
        {
            return Err(Error::Unavailable);
        }
        Ok(token.token)
    }

    fn get(&self, installation: i64) -> Result<Secret> {
        let _refresh = match self.refresh.lock() {
            Ok(guard) => guard,
            Err(_) => return Err(Error::internal(CacheError::Poisoned)),
        };
        if let Some(token) = self.cache.get(installation)?
            && token.expires_at > self.clock.now() + Duration::seconds(60)
        {
            return Ok(token.token);
        }
        let token = self.issuer.issue(installation)?;
        if token.token.expose().is_empty()
            || token.expires_at <= self.clock.now() + Duration::seconds(60)
        {
            return Err(Error::Unavailable);
        }
        self.cache.put(installation, token.clone())?;
        Ok(token.token)
    }

    fn invalidate(&self, installation: i64) -> Result<()> {
        let _refresh = match self.refresh.lock() {
            Ok(guard) => guard,
            Err(_) => return Err(Error::internal(CacheError::Poisoned)),
        };
        self.cache.invalidate(installation)
    }
}
