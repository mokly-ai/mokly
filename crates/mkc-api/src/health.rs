//! Live migration readiness and compile-time release identity.

use std::result;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use mkc_db::migration::{Error, MigrationStatus};
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::{ApiError, Result};

pub(crate) const BUILD_REVISION: &str = match option_env!("MKC_BUILD_SHA") {
    Some(revision) => revision,
    None => "development",
};

/// Health behavior consumed by HTTP dispatch.
#[cfg_attr(test, unimock::unimock(api = [HealthCheckMock]))]
pub(crate) trait HealthCheck: Send + Sync {
    fn check(&self) -> Result<HealthView>;
}

/// Reads migration readiness at startup and after a five-second cache expiry.
/// Concurrent callers share one refresh under the lock, and a current, pending
/// or failed read is cached for the whole interval.
pub(crate) struct DatabaseHealth {
    pub(crate) migrations: Arc<dyn MigrationStatus>,
    pub(crate) clock: Arc<dyn HealthClock>,
    pub(crate) cache: Mutex<Option<CachedHealth>>,
}

/// A monotonic clock keeps cache expiry independent of wall-clock adjustments.
#[cfg_attr(test, unimock::unimock(api = [HealthClockMock]))]
pub(crate) trait HealthClock: Send + Sync {
    fn now(&self) -> Instant;
}

pub(crate) struct SystemHealthClock;

impl HealthClock for SystemHealthClock {
    fn now(&self) -> Instant {
        Instant::now()
    }
}

pub(crate) struct CachedHealth {
    checked_at: Instant,
    readiness: result::Result<bool, Arc<Error>>,
}

#[derive(Debug, Error)]
enum CacheFailure {
    #[error("[mkc-api/health] readiness cache lock was poisoned")]
    Poisoned,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
#[schema(as = Health)]
pub(crate) struct HealthView {
    #[schema(inline)]
    status: HealthStatus,
    #[schema(min_length = 1)]
    version: &'static str,
    /// Git commit embedded at image build, or development locally.
    revision: &'static str,
    #[schema(inline)]
    migrations: MigrationReadiness,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
enum HealthStatus {
    Ok,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
enum MigrationReadiness {
    Current,
}

impl HealthCheck for DatabaseHealth {
    fn check(&self) -> Result<HealthView> {
        let Ok(mut cache) = self.cache.lock() else {
            return Err(ApiError::internal(CacheFailure::Poisoned));
        };
        let now = self.clock.now();
        if cache
            .as_ref()
            .is_none_or(|entry| now.duration_since(entry.checked_at) >= Duration::from_secs(5))
        {
            let readiness = match self.migrations.is_current() {
                Ok(current) => Ok(current),
                Err(error) => Err(Arc::new(error)),
            };
            *cache = Some(CachedHealth {
                checked_at: now,
                readiness,
            });
        }
        match cache.as_ref().map(|entry| &entry.readiness) {
            Some(Ok(true)) => {}
            Some(Ok(false)) => return Err(ApiError::MigrationsPending),
            Some(Err(error)) => {
                return Err(ApiError::internal_with(
                    error.clone(),
                    "check migration readiness",
                ));
            }
            None => return Err(ApiError::internal(CacheFailure::Poisoned)),
        }
        Ok(HealthView {
            status: HealthStatus::Ok,
            version: env!("CARGO_PKG_VERSION"),
            revision: BUILD_REVISION,
            migrations: MigrationReadiness::Current,
        })
    }
}

#[cfg(test)]
#[path = "_tests_/health_tests.rs"]
mod health_tests;
