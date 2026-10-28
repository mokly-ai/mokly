//! On-demand extraction of one commit through the shared source cache.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_git::identity::ObjectId;
use mokly_git::repository::Repository;
use mokly_git::tree::Limits;

use crate::cache_types::{Builder, Cache, Kind, Lease};
use crate::error::{GitResult, Result};

/// Base extraction API used only when JavaScript needs sources on disk.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ExtractionMock))]
pub trait Extraction: Send + Sync {
    /// Acquire a leased source root keyed by commit.
    fn acquire(&self, commit: &ObjectId) -> Result<Lease>;
    /// Lease the complete extraction of `commit` when one exists, without a build.
    fn existing(&self, commit: &ObjectId) -> Result<Option<Lease>>;
}

/// Git source extraction coordinator.
pub struct CachedExtraction {
    /// Validated repository access.
    pub repository: Arc<dyn Repository>,
    /// Shared external cache.
    pub cache: Arc<dyn Cache>,
    /// Maximum source tree nodes.
    pub files: usize,
}

struct Extract<'a> {
    repository: &'a dyn Repository,
    commit: &'a ObjectId,
    limits: Limits,
    built: AtomicBool,
}

impl Builder for Extract<'_> {
    fn reusable(&self) -> bool {
        self.repository.conversion_warnings().is_empty()
    }
    fn build(&self, destination: &Path) -> Result<()> {
        self.built.store(true, Ordering::Relaxed);
        self.repository
            .extract(self.commit, destination, self.limits)
            .at_path(".")
    }
}

impl Extraction for CachedExtraction {
    /// Times the source key, the cache lookup, and a build as one
    /// `review.base-extraction` span whose `action` names the outcome.
    fn acquire(&self, commit: &ObjectId) -> Result<Lease> {
        let span = tracing::info_span!(
            "review.base-extraction",
            status = "error",
            action = tracing::field::Empty
        );
        let _scope = span.enter();
        let limits = Limits {
            bytes: self.cache.capacity(Kind::Sources).saturating_sub(1024) as usize,
            files: self.files,
            nodes: Limits::default().nodes,
            ..Limits::default()
        };
        let builder = Extract {
            repository: self.repository.as_ref(),
            commit,
            limits,
            built: AtomicBool::new(false),
        };
        let lease = self.cache.get(
            Kind::Sources,
            &self.repository.source_key(commit).base()?,
            &builder,
        )?;
        span.record(
            "action",
            if builder.built.load(Ordering::Relaxed) {
                "extract"
            } else {
                "reuse"
            },
        );
        span.record("status", "ok");
        Ok(lease)
    }

    /// Times the source key and the lookup as a `review.base-extraction` span,
    /// whose `action` is `reuse` when a complete entry exists.
    fn existing(&self, commit: &ObjectId) -> Result<Option<Lease>> {
        let span = tracing::info_span!(
            "review.base-extraction",
            status = "error",
            action = tracing::field::Empty
        );
        let _scope = span.enter();
        let key = self.repository.source_key(commit).base()?;
        let lease = self.cache.lease(Kind::Sources, &key)?;
        if lease.is_some() {
            span.record("action", "reuse");
        }
        span.record("status", "ok");
        Ok(lease)
    }
}
