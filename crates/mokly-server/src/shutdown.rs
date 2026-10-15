//! Ordered shutdown hooks for watcher, render, Git, and sidecar integrations.

use async_trait::async_trait;

use crate::error::Result;

/// Later subsystems plug into this order without changing any HTTP route.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = LifecycleMock))]
#[async_trait]
pub trait Lifecycle: Send + Sync {
    /// Stop the watcher and discard its unadopted candidate.
    async fn stop_watcher(&self) -> Result<()>;
    /// Cancel and drain render, background, and comparison work.
    async fn cancel_renders(&self) -> Result<()>;
    /// Terminate Git work and wait for process and pipe closure.
    async fn cancel_git(&self) -> Result<()>;
    /// Ask sidecars to stop, then terminate survivors.
    async fn shutdown_sidecars(&self) -> Result<()>;
    /// Release file locks after all work stopped.
    async fn release(&self) -> Result<()>;
}

/// Fixed HTML catalogue has no watcher, Git, or sidecar process.
pub struct FixedLifecycle;
#[async_trait]
impl Lifecycle for FixedLifecycle {
    async fn stop_watcher(&self) -> Result<()> {
        Ok(())
    }
    async fn cancel_renders(&self) -> Result<()> {
        Ok(())
    }
    async fn cancel_git(&self) -> Result<()> {
        Ok(())
    }
    async fn shutdown_sidecars(&self) -> Result<()> {
        Ok(())
    }
    async fn release(&self) -> Result<()> {
        Ok(())
    }
}
